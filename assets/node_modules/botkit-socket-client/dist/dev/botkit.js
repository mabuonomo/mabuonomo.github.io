Botkit =
/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = __webpack_require__(value);
/******/ 		if(mode & 8) return value;
/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
/******/ 		return ns;
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = "./src/botkit.ts");
/******/ })
/************************************************************************/
/******/ ({

/***/ "./src/botkit.ts":
/*!***********************!*\
  !*** ./src/botkit.ts ***!
  \***********************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
eval("\n\nObject.defineProperty(exports, \"__esModule\", {\n  value: true\n});\n\nvar utils_1 = __webpack_require__(/*! ./utils */ \"./src/utils.ts\");\n\nvar BotKitClient =\n/** @class */\nfunction () {\n  function BotKitClient(config) {\n    this.config = config;\n    this.connectWebsocket();\n  }\n\n  BotKitClient.prototype.getGuid = function () {\n    if (!this.config.userGuid) {\n      this.config.userGuid = utils_1.generateGuid();\n    }\n\n    return this.config.userGuid;\n  };\n  /**\n   * Send e text message\n   * @param text\n   */\n\n\n  BotKitClient.prototype.send = function (text) {\n    this.deliverMessage({\n      type: utils_1.ConnectEvent.MESSAGE,\n      text: text,\n      user: this.getGuid(),\n      channel: 'websocket'\n    });\n    return false;\n  };\n  /**\n   * Create a json version of IbotKitMessage\n   * @param message\n   */\n\n\n  BotKitClient.prototype.deliverMessage = function (message) {\n    console.log(message);\n    this.socket.send(JSON.stringify(message));\n  };\n  /**\n   * Connect to remote botkit websocket\n   */\n\n\n  BotKitClient.prototype.connectWebsocket = function () {\n    // Create WebSocket connection.\n    this.socket = new WebSocket(this.config.ws_url);\n    var self = this; // Connection opened\n\n    this.socket.addEventListener(utils_1.ListenerEvent.OPEN, function (event) {\n      console.log('CONNECTED TO SOCKET');\n      self.deliverMessage({\n        type: self.config.userGuid === undefined ? utils_1.ConnectEvent.HELLO : utils_1.ConnectEvent.WELCOME_BACK,\n        user: self.getGuid(),\n        channel: 'socket'\n      });\n    });\n    this.socket.addEventListener(utils_1.ListenerEvent.ERROR, function (event) {\n      console.error('ERROR', event);\n    });\n    this.socket.addEventListener(utils_1.ListenerEvent.CLOSE, function (event) {\n      console.log('SOCKET CLOSED!');\n    }); // Listen for messages\n\n    this.socket.addEventListener(utils_1.ListenerEvent.MESSAGE, function (event) {\n      var message = null;\n\n      try {\n        console.log('Response: ', event.data);\n        message = JSON.parse(event.data);\n      } catch (err) {\n        return;\n      }\n    });\n  };\n\n  return BotKitClient;\n}();\n\nexports.BotKitClient = BotKitClient;\n\n//# sourceURL=webpack://Botkit/./src/botkit.ts?");

/***/ }),

/***/ "./src/utils.ts":
/*!**********************!*\
  !*** ./src/utils.ts ***!
  \**********************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
eval("\n\nObject.defineProperty(exports, \"__esModule\", {\n  value: true\n});\n\nfunction generateGuid() {\n  function s4() {\n    return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);\n  }\n\n  return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();\n}\n\nexports.generateGuid = generateGuid;\nvar ConnectEvent;\n\n(function (ConnectEvent) {\n  ConnectEvent[\"HELLO\"] = \"hello\";\n  ConnectEvent[\"WELCOME_BACK\"] = \"welcome_back\";\n  ConnectEvent[\"MESSAGE\"] = \"message\";\n})(ConnectEvent = exports.ConnectEvent || (exports.ConnectEvent = {}));\n\nvar ListenerEvent;\n\n(function (ListenerEvent) {\n  ListenerEvent[\"OPEN\"] = \"open\";\n  ListenerEvent[\"MESSAGE\"] = \"message\";\n  ListenerEvent[\"ERROR\"] = \"error\";\n  ListenerEvent[\"CLOSE\"] = \"close\";\n})(ListenerEvent = exports.ListenerEvent || (exports.ListenerEvent = {}));\n\n//# sourceURL=webpack://Botkit/./src/utils.ts?");

/***/ })

/******/ });