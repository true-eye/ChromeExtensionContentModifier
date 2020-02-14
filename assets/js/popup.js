(function(window, jQuery) {

  function showAccountCard() {
    $('#login-card').hide();
    $('#account-card').show();
  }

  function showLoginCard() {
    $('#login-card').show();
    $('#account-card').hide();
  }

  function postMessage(token) {
    
    chrome.tabs.executeScript(null, { file: '/assets/js/jquery-1.11.1.min.js'}, () => {
      chrome.tabs.executeScript(null, { file: '/assets/js/background.js'}, () => {
        chrome.tabs.executeScript(null, { file: '/assets/js/core.js' }, () => {
          chrome.tabs.insertCSS(null, { file: '/assets/css/core.css'}, () => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
              const port = chrome.tabs.connect(tabs[0].id);
              port.postMessage({ action: 'BUTTON_TRIGGER', token });
              port.onMessage.addListener((response) => {
                console.log(response);
              });
            });
          });
        });
      });
    });
  }

  function activate(token, email) {
    // Save token using the Chrome extension storage API.
    chrome.storage.sync.set({ token, email }, function() {
      console.log('Token & Email saved');

      postMessage(token);
    });
  };

  function deactivate() {
    chrome.storage.sync.remove(["token", "email"], function() {
      console.log('Token & Email deleted');

      chrome.tabs.getSelected(null, function(tab) {
        // Send a request to the content script.
        chrome.tabs.query({}, function(tabs) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'DEACTIVATE_EXTENSION' }, function(response) {
            console.log(response)
          })
        });
      });
    });
  };

  $(document).ready(function() {
    chrome.storage.sync.get(["token", "email"], function(store) {

      if (!store.token) {
        showLoginCard();
        return;
      }

      showAccountCard();
      $('#account-email').html(store.email);

      postMessage(store.token);
    });
  });

  $(document).on('click', '#signout', function() {
    $('#inputEmail').val('');
    $('#inputPassword').val('');
    $('.alert-auth-fail').hide();
    showLoginCard();
    deactivate();
  });

  $(document).on('click', '#signin', function() {
    let self = $(this);

    $('.alert-auth-fail').hide();
    self.html('<i class="fa fa-spinner fa-spin"></i>');
    self.attr("disabled", true);

    let endPointUrl = `https://app.hyperise.io/api/v1/regular/auth/login`;

    let payload = {
      email: $('#inputEmail').val(),
      password: $('#inputPassword').val()
    }

    $.ajax({
      url: endPointUrl,
      type: 'POST',
      data: payload,
      success: function(data) {
        if (data.token) {
          console.log('success! token:', data.token);
          self.html('Sign in');
          showAccountCard();
          $('#account-email').html(payload.email);
          activate(data.token, payload.email);
        } else {
          console.log('failed token is undefined')
          $('.alert-auth-fail').show();
          self.html('Try again');
        }
        self.attr("disabled", false);
      },
      error: function(request, error) {
        console.log('failed ', error);
        self.html('Try again');
        self.attr("disabled", false);
        $('.alert-auth-fail').show();
      },
    });
  });
})(window, $);
