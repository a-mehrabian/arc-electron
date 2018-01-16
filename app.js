const ipc = require('electron').ipcRenderer;
const log = require('electron-log');
/**
 * Class responsible for initializing the main ARC elements
 * and setup base options.
 * Also serves as a communication bridge etween main process and app window.
 */
class ArcInit {

  constructor() {
    this.created = false;
    this.workspaceScript = undefined;
    this.settingsScript = undefined;
  }

  get app() {
    return document.getElementById('app');
  }

  listen() {
    ipc.on('window-rendered', this.initApp.bind(this));
    ipc.on('set-workspace-file', this.setupWorkspaceFile.bind(this));
    ipc.on('set-settings-file', this.setupSettingsFile.bind(this));
    window.onbeforeunload = this.beforeUnloadWindow.bind(this);
    var updateHandler = this.updateEventHandler.bind(this);
    ipc.on('checking-for-update', updateHandler);
    ipc.on('update-available', updateHandler);
    ipc.on('update-not-available', updateHandler);
    ipc.on('autoupdate-error', updateHandler);
    ipc.on('download-progress', updateHandler);
    ipc.on('update-downloaded', updateHandler);
    ipc.on('command', this.commandHandler.bind(this));
    ipc.on('request-action', this.execRequestAction.bind(this));
  }

  initApp() {
    log.info('Initializing renderer window.');
    var app = document.createElement('arc-electron');
    app.id = 'app';
    this._setupApp(app);
    document.body.appendChild(app);
    this.created = true;
  }

  setupWorkspaceFile(e, message) {
    log.info('Setting up workspace file:', message);
    this.workspaceScript = message;
    if (!this.created) {
      log.info('The app is not ready. Will set it later.');
      return;
    }
    this.app.workspaceScript = message;
  }

  setupSettingsFile(e, message) {
    log.info('Setting up settings file:', message);
    this.settingsScript = message;
    if (!this.created) {
      log.info('The app is not ready. Will set it later.');
      return;
    }
    this.app.settingsScript = message;
  }

  _setupApp(app) {
    if (this.workspaceScript) {
      app.workspaceScript = this.workspaceScript;
    }
    if (this.settingsScript) {
      app.settingsScript = this.settingsScript;
    }
    log.info('Initializing ARC app');
    app.initApplication();
  }
  /**
   * Because window has to be setup from the main process
   * (setting app init values) the window sends reload
   * information to the main process so it can re-set the
   * window after it's reloaded.
   */
  beforeUnloadWindow() {
    ipc.send('window-reloading');
  }

  /**
   * Handles events related to the application auto-update action.
   */
  updateEventHandler(sender, message) {
    var app = this.app;
    app.updateState = message;
    if (message[0] === 'update-available') {
      app.hasAppUpdate = true;
    }
  }

  commandHandler(event, action, ...args) {
    log.info('Renderer command handled: ', action);
    var app = this.app;
    switch (action) {
      case 'show-settings': app.openSettings(); break;
      case 'about': app.openAbout(); break;
      case 'open-license': app.openLicense(); break;
      case 'import-data': app.openImport(); break;
      case 'export-data': app.openExport(); break;
      case 'open-saved': app.openSaved(); break;
      case 'open-history': app.openHistory(); break;
      case 'open-drive': app.openDrivePicker(); break;
      case 'find': app.handleFindOpen(); break;
      case 'open-messages': app.openInfoCenter(); break;
      case 'login-external-webservice': app.openWebUrl(); break;
      case 'open-cookie-manager': app.openCookieManager(); break;
      case 'open-hosts-editor': app.openHostRules(); break;
      case 'get-tabs-count': this.sendTabsCount(event, args[0]); break;
      case 'activate-tab': this.activateTab(event, args[0], args[1]); break;
      case 'get-request-data': this.getRequestData(event, args[0], args[1]); break;
    }
  }
  /**
   * Remote API command.
   * Sends number of tabs command to the main process.
   *
   * @param {EventEmitter} event
   * @param {Number} callId
   */
  sendTabsCount(event, callId) {
    var cnt = this.app.getTabsCount();
    event.sender.send('current-tabs-count', callId, false, cnt);
  }
  /**
   * Remote API command.
   * Activates a tab in current window.
   *
   * @param {EventEmitter} event
   * @param {Number} callId
   * @param {Number} tabId ID of a tab
   */
  activateTab(event, callId, tabId) {
    this.app.workspace.selected = tabId;
    event.sender.send('tab-activated', callId, false);
  }
  /**
   * Remote API command.
   * Sends request data to the main process.
   *
   * Because of limitations of sending the data between renderer and main process
   * objects like FormData of file data won't be sent.
   *
   * @param {EventEmitter} event
   * @param {Number} callId
   * @param {Number} tabId ID of a tab
   */
  getRequestData(event, callId, tabId) {
    var request = this.app.workspace.activeRequests[tabId];
    event.sender.send('request-data', callId, false, request);
  }
  /**
   * Handles action performed in main thread (menu action) related to
   * a request.
   *
   * @param {String} action Action name to perform.
   */
  execRequestAction(event, action, ...args) {
    log.info('Renderer request command handled: ', action);
    var app = this.app;
    switch (action) {
      case 'save':
        app.saveOpened({
          source: 'shortcut'
        });
      break;
      case 'save-as':
        app.saveOpened();
      break;
      case 'new-tab':
        app.newRequestTab();
      break;
      case 'send-current':
        app.sendCurrentTab();
      break;
      case 'update-request':
        app.updateRequestTab(args[0], args[1]);
      break;
      default:
        throw new Error('Unrecognized action ' + action);
    }
  }
}

const initScript = new ArcInit();
initScript.listen();