// API URLs
var API_URL_LIST_OF_MERGE_TAGS = 'https://app.hyperise.io/api/v1/regular/image-templates/replacements';
var API_URL_LIST_OF_MERGE_IMGS = 'https://app.hyperise.io/api/v1/regular/image-templates';
var API_URL_LIST_OF_PERSONALIZATIONS = 'https://app.hyperise.io/api/v1/regular/website-personalizations';
var TOKEN_EXAMPLE = 'MCceOUC5BoH8g3cpFPouMPJP7gZAA8qfqx8E27xtPp5cgaxVVlpdcEnheRax';

// Unique ID for the className.
var MOUSE_VISITED_CLASSNAME = 'crx_mouse_visited';
var MOUSE_IMG_VISITED_CLASSNAME = 'crx_txt_mouse_visited';
var MOUSE_TXT_VISITED_CLASSNAME = 'crx_img_mouse_visited';
var SELECTED_CLASSNAME = 'crx_selected';
var SELECTED_TYPE_TEXT = 'Text';
var SELECTED_TYPE_IMG = 'Image';
var TextNodeNames = ['DIV', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LABEL', 'BUTTON', 'A', 'SPAN', 'STRONG'];
var ImageNodeNames = ['IMG'];

// Previous dom, that we want to track, so we can remove the previous styling.
var prevDOM = null;
var prevTXTDOM = null;
var prevIMGDOM = null;

// Indicate if the extension is activated or not
// var bActivated = false;

// Indicate the dom, which is selected
var selectedDOM = null;
var selectedType = null;

// Indicate if it's inline text editing mode
var bInlineTextEditing = false;

var metaTags = null;
var metaImgs = null;
var bShowMetaTagsModal = false;
var bShowMetaImgsModal = false;
var bLoadingMetaTags = false;
var bLoadingMetaImgs = false;
var lastCursorPosition = null;

var personalizations = null;
var bLoadingPersonalizations = false;
var sections = [];
var authToken = null;

var searchPattern = '';

(function(window, jQuery) {
  jQuery.fn.getPath = function() {
    var names = [];
    var el = this[0];
    while (el.parentNode) {
      if (el.id) {
        names.unshift('#' + el.id);
        break;
      } else {
        if (el == el.ownerDocument.documentElement) {
          names.unshift(el.tagName.toLowerCase());
        } else {
          for (var c = 1, e = el; e.previousElementSibling; e = e.previousElementSibling, c++);

          names.unshift(el.tagName.toLowerCase() + ':nth-child(' + c + ')');
        }
        el = el.parentNode;
      }
    }
    return names.join(' > ');
  };

  jQuery.fn.getPathArray = function() {
    var names = [];
    var el = this[0];
    while (el.parentNode) {
      if (el.id) {
        names.unshift('#' + el.id);
        break;
      } else {
        if (el == el.ownerDocument.documentElement) {
          names.unshift(el.tagName.toLowerCase());
        } else {
          for (var c = 1, e = el; e.previousElementSibling; e = e.previousElementSibling, c++);

          // names.unshift( el.tagName.toLowerCase() + ":nth-child(" + c + ")" );
          names.unshift(el.tagName.toLowerCase());
        }
        el = el.parentNode;
      }
    }
    return names;
  };

  function setupContextMenu() {
    /**
     * Function to check if we clicked inside an element with a particular class
     * name.
     *
     * @param {Object} e The event
     * @param {String} className The class name to check against
     * @return {Boolean}
     */
    function clickInsideElement(e, className) {
      var el = e.srcElement || e.target;

      if (el.classList.contains(className)) {
        return el;
      } else {
        while ((el = el.parentNode)) {
          if (el.classList && el.classList.contains(className)) {
            return el;
          }
        }
      }

      return false;
    }

    /**
     * Get's exact position of event.
     *
     * @param {Object} e The event passed in
     * @return {Object} Returns the x and y position
     */
    function getPosition(e) {
      var posx = 0;
      var posy = 0;

      if (!e) var e = window.event;
      console.log(e.pageX, e.pageY, e.clientX, e.clientY);

      if (e.pageX || e.pageY) {
        posx = e.pageX;
        posy = e.pageY;
      } else if (e.clientX || e.clientY) {
        posx = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
        posy = e.clientY + document.body.scrollTop + document.documentElement.scrollTop;
      }

      return {
        x: e.clientX,
        y: e.clientY,
      };
    }

    //////////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////
    //
    // C O R E    F U N C T I O N S
    //
    //////////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////

    /**
     * Variables.
     */
    var contextMenuLinkClassName = 'hyperise-extension-context-menu__link';
    var contextMenuActive = 'hyperise-extension-context-menu--active';

    var taskItemClassName = SELECTED_CLASSNAME;
    var taskItemInContext;

    var clickCoords;
    var clickCoordsX;
    var clickCoordsY;

    var menu = document.querySelector('#hyperise-extension-context-menu');
    var menuState = 0;
    var menuWidth;
    var menuHeight;

    var windowWidth;
    var windowHeight;

    /**
     * Initialise our application's code.
     */
    function init() {
      contextListener();
      clickListener();
      keyupListener();
      resizeListener();
    }

    /**
     * Listens for contextmenu events.
     */
    function contextListener() {
      document.addEventListener('contextmenu', function(e) {
        console.log('contextmenu: ', e, taskItemClassName);
        taskItemInContext = clickInsideElement(e, taskItemClassName);

        if (taskItemInContext) {
          e.preventDefault();
          toggleMenuOn();
          positionMenu(e);
        } else {
          taskItemInContext = null;
          toggleMenuOff();
        }
      });
    }

    /**
     * Listens for click events.
     */
    function clickListener() {
      document.addEventListener('click', function(e) {
        var clickeElIsLink = clickInsideElement(e, contextMenuLinkClassName);

        if (clickeElIsLink) {
          e.preventDefault();
          menuItemListener(clickeElIsLink);
        } else {
          var button = e.which || e.button;
          if (button === 1) {
            toggleMenuOff();
          }
        }
      });
    }

    /**
     * Listens for keyup events.
     */
    function keyupListener() {
      window.onkeyup = function(e) {
        if (e.keyCode === 27) {
          toggleMenuOff();
        }
      };
    }

    /**
     * Window resize event listener
     */
    function resizeListener() {
      window.onresize = function(e) {
        toggleMenuOff();
      };
    }

    /**
     * Turns the custom context menu on.
     */
    function toggleMenuOn() {
      if (menuState !== 1) {
        menuState = 1;
        menu.classList.add(contextMenuActive);
      }
    }

    /**
     * Turns the custom context menu off.
     */
    function toggleMenuOff() {
      if (menuState !== 0) {
        menuState = 0;
        menu.classList.remove(contextMenuActive);
      }
    }

    /**
     * Positions the menu properly.
     *
     * @param {Object} e The event
     */
    function positionMenu(e) {
      clickCoords = getPosition(e);
      clickCoordsX = clickCoords.x;
      clickCoordsY = clickCoords.y;

      menuWidth = menu.offsetWidth + 4;
      menuHeight = menu.offsetHeight + 4;

      windowWidth = window.innerWidth;
      windowHeight = window.innerHeight;

      console.log('positions: ', clickCoords, menuWidth, menuHeight, windowWidth, windowHeight);

      if (windowWidth - clickCoordsX < menuWidth) {
        menu.style.left = windowWidth - menuWidth + 'px';
      } else {
        menu.style.left = clickCoordsX + 'px';
      }

      if (windowHeight - clickCoordsY < menuHeight) {
        menu.style.top = windowHeight - menuHeight + 'px';
      } else {
        menu.style.top = clickCoordsY + 'px';
      }
    }

    /**
     * Dummy action function that logs an action when a menu item link is clicked
     *
     * @param {HTMLElement} link The link that was clicked
     */
    function menuItemListener(link) {
      console.log('Task ID - ' + taskItemInContext.getAttribute('data-id') + ', Task action - ' + link.getAttribute('data-action'));
      var action = link.getAttribute('data-action');
      switch (action) {
        case 'EditHtml':
          $('.hyperise-extension-modal-center').show();
          if (selectedDOM && selectedType == SELECTED_TYPE_IMG) {
            $('#hyperise-extension-textarea-edit-html').val(selectedDOM.outerHTML);
          }
          break;
        default:
          break;
      }
      toggleMenuOff();
    }

    /**
     * Run the app.
     */
    init();
  }

  if (document.readyState !== 'loading') {
    console.info('document is already ready, just execute code here');
    myInitCode();
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      console.info('document was not ready, place code here');
      myInitCode();
    });
  }

  function pasteHtmlAtCaret(html) {
    var sel, range;
    if (window.getSelection) {
      // IE9 and non-IE
      sel = window.getSelection();
      if (sel.getRangeAt && sel.rangeCount) {
        range = sel.getRangeAt(0);
        range.deleteContents();

        // Range.createContextualFragment() would be useful here but is
        // non-standard and not supported in all browsers (IE9, for one)
        var el = document.createElement('div');
        el.innerHTML = html;
        var frag = document.createDocumentFragment(),
          node,
          lastNode;
        while ((node = el.firstChild)) {
          lastNode = frag.appendChild(node);
        }
        range.insertNode(frag);

        // Preserve the selection
        if (lastNode) {
          range = range.cloneRange();
          range.setStartAfter(lastNode);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
    } else if (document.selection && document.selection.type != 'Control') {
      // IE < 9
      document.selection.createRange().pasteHTML(html);
    }
  }

  function cursor_changed(element) {
    var new_position = getCursorPosition(element);
    if (new_position !== lastCursorPosition) {
      lastCursorPosition = new_position;
      return true;
    }
    return false;
  }

  function getCursorPosition(element) {
    if ($(window.getSelection().anchorNode).is($(element))) {
      return 0;
    } else {
      return window.getSelection().anchorOffset;
    }
  }

  function createRange(node, chars, range) {
    if (!range) {
      range = document.createRange();
      range.selectNode(node);
      range.setStart(node, 0);
    }

    if (chars.count === 0) {
      range.setEnd(node, chars.count);
    } else if (node && chars.count > 0) {
      if (node.nodeType === Node.TEXT_NODE) {
        if (node.textContent.length < chars.count) {
          chars.count -= node.textContent.length;
        } else {
          range.setEnd(node, chars.count);
          chars.count = 0;
        }
      } else {
        for (var lp = 0; lp < node.childNodes.length; lp++) {
          range = createRange(node.childNodes[lp], chars, range);

          if (chars.count === 0) {
            break;
          }
        }
      }
    }

    return range;
  }

  function setCurrentCursorPosition(position, element) {
    if (position >= 0) {
      var selection = window.getSelection();

      range = createRange(element, { count: position });

      if (range) {
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  }

  function GetListOfMergeTags(token) {
    console.log('GetListOfMergeTags Start');
    metaTags = null;
    bLoadingMetaTags = true;
    $.ajax({
      url: API_URL_LIST_OF_MERGE_TAGS + '?api_token=' + token,
      type: 'GET',
      data: null,
      success: function(data) {
        console.log('GetListOfMergeTags success:');
        if (data) {
          metaTags = data;
        } else {
          metaTags = [];
        }
        renderSelectTagModal();
      },
      error: function(request, error) {
        console.log('GetListOfMergeTags error:');
      },
      complete: function() {
        bLoadingMetaTags = false;
      },
    });
  }

  function GetListOfMergeImgs(token) {
    console.log('GetListOfMergeImgs Start');
    metaImgs = null;
    bLoadingMetaImgs = true;
    $.ajax({
      url: API_URL_LIST_OF_MERGE_IMGS + '?api_token=' + token,
      type: 'GET',
      data: null,
      success: function(data) {
        console.log('GetListOfMergeImgs success:');
        if (data) {
          metaImgs = data;
        } else {
          metaImgs = [];
        }
        renderSelectImgModal();
      },
      error: function(request, error) {
        console.log('GetListOfMergeImgs error:');
      },
      complete: function() {
        bLoadingMetaImgs = false;
      },
    });
  }

  function GetListOfPersonalizationsPromise(token) {
    return new Promise(async (resolve, reject) => {
      $.ajax({
        url: API_URL_LIST_OF_PERSONALIZATIONS + '?api_token=' + token,
        type: 'GET',
        data: null,
        success: function(data) {
          resolve(data);
        },
        error: function(request, error) {
          reject(error);
        },
      });
    });
  }

  function GetListOfPersonalizations(token) {
    console.log('GetListOfPersonalizations Start');
    personalizations = null;
    bLoadingPersonalizations = true;
    GetListOfPersonalizationsPromise(token)
      .then(data => {
        console.log('GetListOfPersonalizations success:');
        if (data) {
          personalizations = data;
        } else {
          personalizations = [];
        }
      })
      .catch(error => {
        console.log('GetListOfPersonalizations error:');
      })
      .finally(() => {
        bLoadingPersonalizations = false;
      });
  }

  function isActivated() {
    var bodyClass = $('body:first').attr('class');
    if (!bodyClass) return false;
    var classList = bodyClass.split(/\s+/);
    if (classList && classList.includes('extension-active')) {
      return true;
    }
    return false;
  }

  function activateExtension(token) {
    $('body:first').addClass('extension-active');
    // bActivated = true;

    GetListOfMergeTags(token);
    GetListOfMergeImgs(token);
    GetListOfPersonalizations(token);
    authToken = token;
    console.log('activateExtension', authToken);
  }

  function removeAllClass(className) {
    var elements = $('.' + className);
    for (var i = 0; i < elements.length; i++) {
      $(elements[i]).removeClass(className);
    }
  }

  function removeContentEditable(className) {
    var elements = $('.' + className);
    for (var i = 0; i < elements.length; i++) {
      $(elements[i]).removeAttr('contenteditable');
    }
  }

  function deactivateExtension() {
    $('body:first').removeClass('extension-active');

    removeAllClass(MOUSE_TXT_VISITED_CLASSNAME);
    removeAllClass(MOUSE_IMG_VISITED_CLASSNAME);
    removeAllClass(SELECTED_CLASSNAME);
    removeContentEditable(SELECTED_CLASSNAME);

    if (prevTXTDOM != null) {
      prevTXTDOM.classList.remove(MOUSE_TXT_VISITED_CLASSNAME);
    }
    if (prevIMGDOM != null) {
      prevIMGDOM.classList.remove(MOUSE_IMG_VISITED_CLASSNAME);
    }
    if (selectedDOM != null) {
      selectedDOM.classList.remove(SELECTED_CLASSNAME);
    }
    // bActivated = false;
    selectedDOM = null;
    selectedType = null;

    bInlineTextEditing = false;

    metaTags = null;
    metaImgs = null;
    bShowMetaTagsModal = false;
    bShowMetaImgsModal = false;
    bLoadingMetaTags = false;
    bLoadingMetaImgs = false;
    lastCursorPosition = null;

    personalizations = null;
    bLoadingPersonalizations = false;
    sections = [];
    authToken = null;
    searchPattern = '';
    $('.hyperise-extension-modal-center').hide();
  }

  function isExtensionElement(srcElement) {
    if (srcElement && srcElement.className && typeof srcElement.className == 'string' && srcElement.className.includes('hyperise-extension')) return true;
    return false;
  }

  function addStyleToDom(url) {
    var s = document.createElement('link');
    s.type = 'text/css';
    s.rel = 'stylesheet';
    s.href = url;
    (document.head || document.documentElement).appendChild(s);
  }

  function renderTopBar() {
    console.log('renderTopBar', count);
    var count = 0;
    var domain = window.location.hostname;
    var page = window.location.pathname + window.location.search;
    var index = -1;

    if (personalizations) {
      index = personalizations.findIndex(p => p.domain == domain && p.page == page);
    }

    if (index >= 0) {
      count = personalizations[index].context && personalizations[index].context.length;
    }

    var title = count + ' Personalization Change' + (count > 1 ? 's' : '');
    var disabled = !sections || sections.length == 0 ? 'disabled' : '';

    $('.hyperise-extension-top-bar').html(
      '<button class="hyperise-extension-top-bar-button hyperise-extension-top-bar-cancel" ' +
        disabled +
        ' >Cancel</button>' +
        title +
        '<button class="hyperise-extension-top-bar-button hyperise-extension-top-bar-save" ' +
        disabled +
        ' >Save</button>',
    );

    $('.hyperise-extension-top-bar-cancel').click(function() {
      sections = [];
      renderTopBar();
    });

    $('.hyperise-extension-top-bar-save').click(function() {
      if (sections.length == 0) return;

      var newSections = sections;
      sections = [];

      $('.hyperise-extension-top-bar-save').html('Saving...');

      var domain = window.location.hostname;
      var page = window.location.pathname + window.location.search;

      personalizations = null;
      bLoadingPersonalizations = true;
      GetListOfPersonalizationsPromise(authToken)
        .then(data => {
          console.log('GetListOfPersonalizations success:');
          if (data) {
            personalizations = data;
          } else {
            personalizations = [];
          }

          var upsertData = [...personalizations]
          var index = -1;

          if (personalizations) {
            index = personalizations.findIndex(p => p.domain == domain && p.page == page);
          }

          if (index >= 0) {
            upsertData[index].context = 
          }

          if (myPersonalization) {
            // needs to update the original
            $.ajax({
              url: API_URL_LIST_OF_PERSONALIZATIONS + '/' + myPersonalization.id + '?api_token=' + authToken,
              type: 'POST',
              data: {
                domain: domain,
                page: page,
                context: myPersonalization.context ? myPersonalization.context.concat(newSections) : newSections,
              },
              success: function(data) {
                console.log('Update Personalizations Success', data);
              },
              error: function(request, error) {
                console.log('Update Personalizations Error');
              },
              complete: function() {
                renderTopBar(sections.length);
              },
            });
          } else {
            // needs to create new personalization

            $.ajax({
              url: API_URL_LIST_OF_PERSONALIZATIONS + '?api_token=' + authToken,
              type: 'POST',
              data: {
                domain: domain,
                page: page,
                context: newSections,
              },
              success: function(data) {
                console.log('Create Personalizations Success', data);
              },
              error: function(request, error) {
                console.log('Create Personalizations Error');
              },
              complete: function() {
                renderTopBar(sections.length);
              },
            });
          }
        })
        .catch(error => {
          console.log('GetListOfPersonalizations error:');
        })
        .finally(() => {
          bLoadingPersonalizations = false;
        });
    });
  }

  function dragElement(elmnt, headerElmnt) {
    var pos1 = 0,
      pos2 = 0,
      pos3 = 0,
      pos4 = 0;
    if (headerElmnt) {
      // if present, the header is where you move the DIV from:
      headerElmnt.onmousedown = dragMouseDown;
    } else {
      // otherwise, move the DIV from anywhere inside the DIV:
      elmnt.onmousedown = dragMouseDown;
    }

    function dragMouseDown(e) {
      e = e || window.event;
      e.preventDefault();
      // get the mouse cursor position at startup:
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = closeDragElement;
      // call a function whenever the cursor moves:
      document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
      e = e || window.event;
      e.preventDefault();
      // calculate the new cursor position:
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      // set the element's new position:
      elmnt.style.top = elmnt.offsetTop - pos2 + 'px';
      elmnt.style.left = elmnt.offsetLeft - pos1 + 'px';
    }

    function closeDragElement() {
      // stop moving when mouse button is released:
      document.onmouseup = null;
      document.onmousemove = null;
    }
  }

  function addTop() {
    var element = document.createElement('div');
    element.className = 'hyperise-extension-top';
    element.innerHTML = `
            <div class="hyperise-extension-top-bar">
                <button class="hyperise-extension-top-bar-button hyperise-extension-top-bar-cancel" disabled>Cancel</button>
                    0 Personalization Change
                <button class="hyperise-extension-top-bar-button hyperise-extension-top-bar-save" disabled>Save</button>
            </div>
            <div class="hyperise-extension-top-toolbar">
                <div class="hyperise-extension-top-toolbar-left">
                    <i class="fa fa-vector-square"></i>
                </div>
                <div class="hyperise-extension-top-toolbar-center" style="flex-grow: 1;">
                    <ul class="hyperise-extension-breadcrumb">
                    </ul>
                </div>
                <div class="hyperise-extension-top-toolbar-right">
                    <i class="fas fa-sliders-h"></i>
                    <i class="fas fa-code"></i>
                    <i class="fas fa-desktop"></i>
                    <i class="fas fa-cog"></i>
                </div>
            </div>
            <div class="hyperise-extension-modal-select-tag">
                <div class="hyperise-extension-modal-select-tag-header">
                    Select Tag
                </div>
                <div class="hyperise-extension-modal-select-tag-body">
                    <ul class="hyperise-extension-modal-select-tag-body-list">
                        <li class="hyperise-extension-modal-select-tag-body-list-item">{{first_name}}</li>
                        <li class="hyperise-extension-modal-select-tag-body-list-item">{{last_name}}</li>
                        <li class="hyperise-extension-modal-select-tag-body-list-item">{{business_name}}</li>
                        <li class="hyperise-extension-modal-select-tag-body-list-item">{{website}}</li>
                        <li class="hyperise-extension-modal-select-tag-body-list-item">{{job_title}}</li>
                        <li class="hyperise-extension-modal-select-tag-body-list-item">{{website}}</li>
                        <li class="hyperise-extension-modal-select-tag-body-list-item">{{cool}}</li>
                        <li class="hyperise-extension-modal-select-tag-body-list-item">{{nice}}</li>
                    </ul>
                </div>
            </div>
            <div class="hyperise-extension-modal-select-img">
                <div class="hyperise-extension-modal-select-img-header">
                    Select Image
                </div>
                <input class="hyperise-extension-modal-select-img-search" type="text" placeholder="Search Images" />
                <div class="hyperise-extension-modal-select-img-body">
                    <ul class="hyperise-extension-modal-select-img-body-list">
                        <img class="hyperise-extension-modal-select-img-body-list-item-img" src="https://storage.googleapis.com/growthlist-storage/app/images/users/2/editor/preview/image_1581076180_6468.png" />
                    </ul>
                </div>
            </div>
            <div class="hyperise-extension-modal-center">
                <div class="hyperise-extension-modal-center-header">
                    Edit HTML
                </div>
                <div class="hyperise-extension-modal-center-body">
                    <textarea class="hyperise-extension-modal-center-body-textarea" id="hyperise-extension-textarea-edit-html" ></textarea>
                    <div class="hyperise-extension-modal-center-body-button-group">
                        <a class="hyperise-extension-button-link" id="hyperise-extension-button-link-cancel">Cancel</button>
                        <a class="hyperise-extension-button-link" id="hyperise-extension-button-link-apply">Apply</button>
                    </div>
                </div>
            </div>
            <nav id="hyperise-extension-context-menu" class="hyperise-extension-context-menu">
                <ul class="hyperise-extension-context-menu__items">
                    <li class="hyperise-extension-context-menu__item">
                        <a href="#" class="hyperise-extension-context-menu__link" data-action="Remove">Remove</a>
                    </li>
                    <li class="hyperise-extension-context-menu__item">
                        <a href="#" class="hyperise-extension-context-menu__link" data-action="EditText">Edit Text</a>
                    </li>
                    <li class="hyperise-extension-context-menu__item">
                        <a href="#" class="hyperise-extension-context-menu__link" data-action="EditHtml">Edit HTML</a>
                    </li>
                    <li class="hyperise-extension-context-menu__item">
                        <a href="#" class="hyperise-extension-context-menu__link" data-action="Insert">Insert</a>
                    </li>
                    <li class="hyperise-extension-context-menu__item">
                        <a href="#" class="hyperise-extension-context-menu__link" data-action="RunJS">Run Javascript</a>
                    </li>
                </ul>
            </nav>
        `;

    if (document.body) {
      document.body.insertBefore(element, document.body.firstChild);
    }

    $('.hyperise-extension-modal-select-img-search').on('input', function(e) {
      searchPattern = e.target.value;
      renderSelectImgModal();
    });

    $('#hyperise-extension-button-link-cancel').click(function() {
      $('.hyperise-extension-modal-center').hide();
    });

    $('#hyperise-extension-button-link-apply').click(function() {
      var newHtml = $('#hyperise-extension-textarea-edit-html').val();
      if (selectedDOM && selectedType == SELECTED_TYPE_IMG) {
        selectedDOM.outerHTML = newHtml;
      }
      $('.hyperise-extension-modal-center').hide();
    });

    dragElement(document.querySelector('.hyperise-extension-modal-select-tag'), document.querySelector('.hyperise-extension-modal-select-tag-header'));
    dragElement(document.querySelector('.hyperise-extension-modal-select-img'), document.querySelector('.hyperise-extension-modal-select-img-header'));
    dragElement(document.querySelector('.hyperise-extension-modal-center'), document.querySelector('.hyperise-extension-modal-center-header'));
  }

  function setCSSNamesToTop(srcElement) {
    var names = $(srcElement).getPathArray();
    var html = '';
    for (var name of names) {
      html += '<li><a href="#" class="hyperise-extension-breadcrumb-item">' + name + '</a></li>';
    }
    $('.hyperise-extension-breadcrumb').html(html);
  }

  function addedExtension() {
    var top = $('.hyperise-extension-top')[0];
    return top != undefined;
  }

  function myInitCode() {
    if (!addedExtension()) {
      addStyleToDom('https://use.fontawesome.com/releases/v5.12.1/css/all.css');
      addStyleToDom('https://use.fontawesome.com/releases/v5.12.1/css/v4-shims.css');
      addStyleToDom(chrome.runtime.getURL('/assets/css/ui.css'));
      addTop();
    }

    chrome.storage.sync.get(['token'], function(store) {
      if (isActivated() && store.token) {
        activateExtension(store.token);
      } else {
        deactivateExtension();
      }
    });
  }

  function replaceSelectedText(replacementText) {
    var sel, range;
    if (window.getSelection) {
      sel = window.getSelection();
      if (sel.rangeCount) {
        range = sel.getRangeAt(0);
        if (document.queryCommandSupported('insertText')) {
          document.execCommand('insertText', false, replacementText);
        } else {
          range.deleteContents();
          range.insertNode(document.createTextNode(replacementText));
        }
      }
    } else if (document.selection && document.selection.createRange) {
      range = document.selection.createRange();
      range.text = replacementText;
    }
  }

  function handleSelectTag(e) {
    e.preventDefault();
    if (selectedDOM) {
      replaceSelectedText(this.innerHTML);

      var path = $(selectedDOM).getPath();
      var newSection = {
        selector: path,
        type: SELECTED_TYPE_TEXT,
        image_template_id: null,
        new_content: selectedDOM.innerHTML,
      };
      var sectionIndex = sections.findIndex(section => section.selector == path);
      if (sectionIndex >= 0) {
        sections[sectionIndex] = newSection;
      } else {
        sections.push(newSection);
      }
      renderTopBar(sections.length);
    }
  }

  function renderSelectTagModal(show) {
    if (show != undefined) bShowMetaTagsModal = show;
    if (bShowMetaTagsModal) {
      if (bLoadingMetaTags) {
        // need to show loading... inside the SelectTagModal
        $('.hyperise-extension-modal-select-tag-body').html('<span>Loading...</span>');
      } else {
        if (!metaTags || !metaTags.length) {
          $('.hyperise-extension-modal-select-tag-body').html('<span>No Tags<span>');
        } else {
          $('.hyperise-extension-modal-select-tag-body').html('<ul class="hyperise-extension-modal-select-tag-body-list"></ul>');

          var html = '';
          for (let tag of metaTags) {
            html += '<li class="hyperise-extension-modal-select-tag-body-list-item" tag="' + tag + '">{{' + tag + '}}</li>';
          }

          $('.hyperise-extension-modal-select-tag-body-list').html(html);
          $('.hyperise-extension-modal-select-tag-body-list-item').bind('mousedown', handleSelectTag);
        }
      }
      $('.hyperise-extension-modal-select-tag').css('display', 'flex');
    } else $('.hyperise-extension-modal-select-tag').css('display', 'none');
  }

  function handleSelectImg(e) {
    e.preventDefault();
    if (selectedDOM && selectedType == SELECTED_TYPE_IMG) {
      if (this.firstChild) {
        var id = parseInt(this.firstChild.getAttribute('id'));
        var index = metaImgs.findIndex(img => img.id == id);

        if (index >= 0 && metaImgs[index]) {
          var newURL = metaImgs[index].base_url + metaImgs[index].image_url;

          if (selectedDOM.getAttribute('srcset')) {
            selectedDOM.setAttribute('srcset', newURL);
          } else if (selectedDOM.getAttribute('src')) {
            selectedDOM.setAttribute('src', newURL);
          }

          var path = $(selectedDOM).getPath();
          var newSection = {
            selector: path,
            type: SELECTED_TYPE_IMG,
            image_template_id: metaImgs[index].id,
            merge_tag: null,
          };
          var sectionIndex = sections.findIndex(section => section.selector == path);
          if (sectionIndex >= 0) {
            sections[sectionIndex] = newSection;
          } else {
            sections.push(newSection);
          }
          renderTopBar(sections.length);
        }
      }
    }
  }

  function renderSelectImgModal(show) {
    if (show != undefined) bShowMetaImgsModal = show;
    if (bShowMetaImgsModal) {
      if (bLoadingMetaImgs) {
        // need to show loading... inside the SelectImgModal
        $('.hyperise-extension-modal-select-img-body').html('<span>Loading...</span>');
      } else {
        var images = metaImgs;
        if (metaImgs && searchPattern && searchPattern != '') {
          images = metaImgs.filter(img => img.name.toLowerCase().includes(searchPattern.toLowerCase()));
        }
        if (!images || !images.length) {
          $('.hyperise-extension-modal-select-img-body').html('<span>No Images<span>');
        } else {
          $('.hyperise-extension-modal-select-img-body').html('<ul class="hyperise-extension-modal-select-img-body-list"></ul>');

          var html = '';
          for (let index in images) {
            var img = images[index];
            var imgSrc = img.preview_image;
            if (!img.preview_image || img.preview_image == '/img/editor/default_preview.png') imgSrc = img.base_url + img.image_url;
            html += `<li class="hyperise-extension-modal-select-img-body-list-item"><img class="hyperise-extension-modal-select-img-body-list-item-img" id="${img.id} alt="${img.name}" src="${imgSrc}" /></li>`;
          }

          $('.hyperise-extension-modal-select-img-body-list').html(html);
          $('.hyperise-extension-modal-select-img-body-list-item').bind('mousedown', handleSelectImg);
        }
      }
      $('.hyperise-extension-modal-select-img').css('display', 'flex');
    } else $('.hyperise-extension-modal-select-img').css('display', 'none');
  }

  document.addEventListener(
    'click',
    function(e) {
      e.preventDefault();
      let srcElement = e.target;

      if (!isActivated()) return;
      if (isExtensionElement(srcElement)) return;

      if (selectedDOM == srcElement) {
        // Select previous selected element
        if (TextNodeNames.includes(srcElement.nodeName)) {
          // If Text Node
          if (!bInlineTextEditing) {
            // Not yet Inline Editing
            bInlineTextEditing = true;
            srcElement.setAttribute('contenteditable', true);
            renderSelectTagModal(true);
            $(srcElement).bind('keydown click', function() {
              cursor_changed(this);
            });
          }
        } else if (ImageNodeNames.includes(srcElement.nodeName)) {
          // If Image Node
          // Todo here
        }
      } else {
        // Select new element
        // init InlineTextEditing mode
        if (bInlineTextEditing) {
          bInlineTextEditing = false;
          if (selectedDOM) {
            selectedDOM.setAttribute('contenteditable', false);
            renderSelectTagModal(false);
          }
        }

        if (selectedType === SELECTED_TYPE_IMG && selectedDOM && !ImageNodeNames.includes(srcElement.nodeName)) renderSelectImgModal(false);

        if (TextNodeNames.includes(srcElement.nodeName)) {
          // If Text Node
          // - remove the solid outline from previous element
          if (selectedDOM != null) {
            selectedDOM.classList.remove(SELECTED_CLASSNAME);
          }

          setCSSNamesToTop(srcElement);

          // - add a solid outline to new selected element
          selectedDOM = srcElement;
          srcElement.classList.add(SELECTED_CLASSNAME);
          selectedType = SELECTED_TYPE_TEXT;
        } else if (ImageNodeNames.includes(srcElement.nodeName)) {
          // If Image Node
          // - remove the solid outline from previous element
          if (selectedDOM != null) {
            selectedDOM.classList.remove(SELECTED_CLASSNAME);
          }

          setCSSNamesToTop(srcElement);
          // - add a solid outline to new selected element
          selectedDOM = srcElement;
          srcElement.classList.add(SELECTED_CLASSNAME);
          selectedType = SELECTED_TYPE_IMG;

          renderSelectImgModal(true);
          setupContextMenu();
        }
      }
    },
    false,
  );

  // Mouse listener for any move event on the current document.
  document.addEventListener(
    'mousemove',
    function(e) {
      let srcElement = e.srcElement;

      if (!isActivated()) return;
      if (isExtensionElement(srcElement)) return;

      // Lets check if our underlying element is a IMG.
      if (prevIMGDOM != srcElement && ImageNodeNames.includes(srcElement.nodeName)) {
        // For NPE checking, we check safely. We need to remove the class name
        // Since we will be styling the new one after.
        if (prevIMGDOM != null) {
          prevIMGDOM.classList.remove(MOUSE_IMG_VISITED_CLASSNAME);
        }

        // Add a visited class name to the element. So we can style it.
        srcElement.classList.add(MOUSE_IMG_VISITED_CLASSNAME);

        // The current element is now the previous. So we can remove the class
        // during the next ieration.
        prevIMGDOM = srcElement;
        // console.info(srcElement.currentSrc);
        // console.dir(srcElement);
      }

      // Lets check if our underlying element is a Text.
      if (prevTXTDOM != srcElement && TextNodeNames.includes(srcElement.nodeName)) {
        // For NPE checking, we check safely. We need to remove the class name
        // Since we will be styling the new one after.
        if (prevTXTDOM != null) {
          prevTXTDOM.classList.remove(MOUSE_TXT_VISITED_CLASSNAME);
        }

        // Add a visited class name to the element. So we can style it.
        srcElement.classList.add(MOUSE_TXT_VISITED_CLASSNAME);

        // The current element is now the previous. So we can remove the class
        // during the next ieration.
        prevTXTDOM = srcElement;
        // console.info(srcElement.currentSrc);
        // console.dir(srcElement);
      }
    },
    false,
  );

  // chrome.extension.onMessage.addListener(function(request, sender, sendResponse) {
  //     console.log('onMessageHandler', request);
  //     switch(request.action) {
  //         case "ACTIVATE_EXTENSION":
  //             activateExtension(request.token);
  //             sendResponse(true);
  //             return true;

  //         case "DEACTIVATE_EXTENSION":
  //             deactivateExtension();
  //             sendResponse(true);
  //             return true;

  //         default:
  //             break;
  //     }
  // });

  var bInjected = false;

  chrome.runtime.onConnect.addListener(port => {
    if (bInjected) return;
    console.log('onConnect port:', port);
    port.onMessage.addListener(msg => {
      if (bInjected) return;

      console.log('port onMessage', msg);
      bInjected = true;

      switch (msg.action) {
        case 'BUTTON_TRIGGER':
          console.log('bActivated in BUTTON_TRIGGER', isActivated());
          if (!isActivated()) {
            if (msg.token) activateExtension(msg.token);
            else window.location.reload(false);
          } else {
            if (msg.token) window.location.reload(false);
          }
          break;
        default:
          break;
      }
    });
  });
})(window, $);
