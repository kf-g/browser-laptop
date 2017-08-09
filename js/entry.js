/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Stylesheets are included here for webpack live reloading
require('../less/window.less')
require('../less/button.less')
require('../less/contextMenu.less')
require('../less/main.less')
require('../less/navigationBar.less')
require('../less/forms.less')
require('../less/switchControls.less')
require('../less/tabs.less')
require('../less/findbar.less')
require('../less/downloadBar.less')
require('../less/bookmarksToolbar.less')
require('../less/notificationBar.less')
require('../node_modules/font-awesome/css/font-awesome.css')

const React = require('react')
const ReactDOM = require('react-dom')
const Immutable = require('immutable')
const patch = require('immutablepatch')
const electron = require('electron')
const ipc = electron.ipcRenderer
const webFrame = electron.webFrame

// Components
const Window = require('../app/renderer/components/window')

// Store
const windowStore = require('./stores/windowStore')
const appStoreRenderer = require('./stores/appStoreRenderer')

// Actions
const windowActions = require('./actions/windowActions')
const appActions = require('./actions/appActions')

// Constants
const messages = require('./constants/messages')

// Utils
const l10n = require('./l10n')
const currentWindow = require('../app/renderer/currentWindow')

webFrame.setPageScaleLimits(1, 1)

l10n.init()

ipc.on(messages.REQUEST_WINDOW_STATE, (evt, requestId) => {
  ipc.send(messages.RESPONSE_WINDOW_STATE, windowStore.getState().toJS(), requestId)
})

if (process.env.NODE_ENV === 'test') {
  electron.testData = {
    appStoreRenderer,
    windowActions,
    windowStore
  }
  appActions.changeSetting('tabs.show-dashboard-images', false)
}

ipc.on(messages.APP_STATE_CHANGE, (e, action) => {
  appStoreRenderer.state = action.stateDiff
    ? appStoreRenderer.state = patch(appStoreRenderer.state, Immutable.fromJS(action.stateDiff))
    : appStoreRenderer.state = Immutable.fromJS(action.state)
})

ipc.on(messages.CLEAR_CLOSED_FRAMES, () => {
  windowActions.clearClosedFrames()
})

window.addEventListener('beforeunload', function (e) {
  ipc.send(messages.LAST_WINDOW_STATE, windowStore.getState().toJS())
})

ipc.on(messages.INITIALIZE_WINDOW, (e, mem) => {
  const message = mem.memory()
  const windowValue = message.windowValue

  currentWindow.setWindowId(windowValue.id)
  const newState = Immutable.fromJS(message.windowState) || windowStore.getState()

  appStoreRenderer.state = Immutable.fromJS(message.appState)
  windowStore.state = newState
  generateTabs(newState, message.frames, windowValue.id)
  appActions.windowReady(windowValue.id)
  ReactDOM.render(<Window />, document.getElementById('appContainer'))
})

const generateTabs = (windowState, frames, windowId) => {
  const activeFrameKey = windowState.get('activeFrameKey')

  frames.forEach((frame, i) => {
    if (frame.guestInstanceId) {
      appActions.newWebContentsAdded(windowId, frame)
    } else {
      appActions.createTabRequested({
        url: frame.location || frame.src || frame.provisionalLocation,
        partitionNumber: frame.partitionNumber,
        isPrivate: frame.isPrivate,
        active: activeFrameKey ? frame.key === activeFrameKey : true,
        discarded: frame.unloaded,
        title: frame.title,
        faviconUrl: frame.icon,
        index: i
      }, false, true /* isRestore */)
    }
  })
}
