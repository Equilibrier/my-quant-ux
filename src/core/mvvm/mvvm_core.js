const codeFunction = function(){
let data = null // this must stay on line 1, as it is hardcode-removed from the sources, when building the Qux script

class Model {

	constructor() {
		this.listeners_ = {}
		this.loaded_ = this._load()
		if (!this.loaded_) {
			console.error(`Model ${this.constructor.name} could not be properly loaded...`)
		}
	}
		
	// PUBLIC, to be used methods
	loaded() { return this.loaded_ }
	
	get(prop) { // do NOT be overriden, this will be the public method used by external callers
		return this._get(prop)
	}
	set(prop, value) { // do NOT be overriden, this will be the public method used by external callers
		const res = this._set(prop, value)
		if (res) {
			this._save()
			if (res.signal) {
				this._trigger(res.signal, res.payload)
			}
		}
		return res != null; // true/false, set succeeded or not
	}
	operate(op, payload, prop=null) { // do NOT be overriden, this will be the public method used by external callers -- prop as null means an operation on the whole model, props != null means operation on a certain prop (sub-model/characteristic of the model)
		const res = this._operate(op, payload, prop)
		if (res) {
			this._save()
			if (res.signal) {
				this._trigger(res.signal, res.payload)
			}
		}
		// this does an operation on the model
		return res !== null; // true/false, operate succeeded or not
	}
	lookup(method, payload, prop=null) { // do NOT be overriden, this will be the public method used by external callers -- prop as null means a lookup on the whole model, props != null means lookup on a certain prop (sub-model/characteristic of the model)
		const res = this._lookup(method, payload, prop)
		return res; // true/false, lookup succeeded or not
	}
	
	registerForModelChange(signal, clbk) { // clbk has two params: prop/op and value/payload
		this.listeners_[signal] = this.listeners_[signal] === undefined ? [] : this.listeners_[signal]
		this.listeners_[signal].push(clbk)
	}
	
	// INTERNAL methods
	_trigger(signal, payload) {
		if (this.listeners_[signal]) {
			for (let clbk of this.listeners_[signal]) {
				if (clbk) {
					clbk(signal, payload)
				}
			}
		}
	}
	
	// TO-be-OVERRIDEN methods
	_save() { // to be overriden, method that saves the model into a persistent db
		return false // returns true/false if the data was succesfully saved
	}
	_load() { // to be overriden, method that loads the model from a persistent db
		return false // returns true/false if the data was succesfully loaded
	}
	_get(prop) { // to be overriden
		prop ? null : null // get rid of strict-mode error
		return null;
	}
	_set(prop, value) { // to be overriden, method that sets a property
		prop ? null : null // get rid of strict-mode error
		value ? null : null // get rid of strict-mode error
		return false; // true/false, set succeeded or not
	}
	_operate(op, payload, prop) { // to be overriden, method that does an operation on the model  -- you can implement any number of operations with a simple switch in here
		op ? null : null // get rid of strict-mode error
		payload ? null : null // get rid of strict-mode error
		prop ? null : null // get rid of strict-mode error
		return false; // true/false, operate succeeded or not
	}
	_lookup(method, payload, prop) { // to be overriden, method that is applying a special lookup method to retrieve some specific value from the model -- you can implement any number of lookups with a simple switch in here
		method ? null : null // get rid of strict-mode error
		payload ? null : null // get rid of strict-mode error
		prop ? null : null // get rid of strict-mode error
		return null
	}
}

class QueuedEvent {

	static Factory = (context) => {

		console.log(`ctx: ${JSON.stringify(context)}`)
		console.log(`ctx-ecrane: ${JSON.stringify(context.screensStack_)}`)

		const __insertContext = (payload) => {
			return {
				...payload,
				source_screen: context.lastScreen(), 
				previous_screen: context.previousScreen()
			}
		}

		return {
			createClickEvent: (sourceElement) => {
				console.log(`se: ${JSON.stringify(sourceElement)}; `)
				return new QueuedEvent(QueuedEvent.TYPE__CLICK, __insertContext({source_element: sourceElement }))
			},
			createAsyncEvent: (cmdId) => {
				return new QueuedEvent(QueuedEvent.TYPE__ASYNC, __insertContext({cmd_id: cmdId}))
			},
			createDatabindEvent: (bindingName, value) => {
				return new QueuedEvent(QueuedEvent.TYPE__DATABIND, __insertContext({ databinding: bindingName, value }))
			}
		}
	}

	static TYPE__CLICK = "click"
	static TYPE__ASYNC = "async"
	static TYPE__DATABIND = "databind"

	constructor(type, payload) {
		this.type_ = type
		this.payload_ = payload
	}

	isClickEvent() { return this.type_ === QueuedEvent.TYPE__CLICK }
	isAsyncEvent() { return this.type_ === QueuedEvent.TYPE__ASYNC }
	isDatabindEvent() { return this.type_ === QueuedEvent.TYPE__DATABIND }

	clickSourceElement() { return this.isClickEvent() ? this.payload_?.source_element : undefined }
	asyncCmdId() { return this.isAsyncEvent() ? this.payload_?.cmd_id: undefined }
	databindBinding() { return this.isDatabindEvent() ? this.payload_?.databinding : undefined }
	databindNewValue() { return this.isDatabindEvent() ? this.payload_?.value : undefined }

	sourceScreen() { return this.payload_?.source_screen }
	previousScreen() { return this.payload_?.previous_screen }

	toUIEvent() {
		if (this.isClickEvent()) {
			return new UIEvent(this.clickSourceElement(), "click")
		}
		else if (this.isAsyncEvent()) {
			return new UIEvent(this.asyncCmdId(), 'async_screen')
		}
		else if (this.isDatabindEvent()) {
			return new UIEvent(this.databindBinding(), 'type', this.databindNewValue())
		}
		console.error(`Could not convert QueuedEvent to UIEvent for type: ${this.type()} and payload ${JSON.stringify(this.payload())}`)
		return null
	}

	type() { return this.type_ }
	payload() { return this.payload_ }
}

class QueuedUIInstruction {
	static TYPE__DELAY = "delay"
	static TYPE__PUSHSCREEN = "push-screen"
	static TYPE__POPSCREEN = "pop-screen"
	static TYPE__UPDATESCREEN = "update-screen"

	static createDelayInstruction(timeMs) {
		return new QueuedUIInstruction(QueuedUIInstruction.TYPE__DELAY, timeMs)
	}
	static createPushScreenInstruction(screenUrl) {
		const _parseParams = (raw) => {
			let pa = {}
			const exprs = raw.split("&")
			for (let e of exprs) {
				const tokens = e.split("=")
				pa[tokens[0]] = tokens[1]
			}
			return pa
		}
		const _parseScreenUrl = (url) => {
			const paramsRaw_ = url && url.includes("?") ? url.substring(url.indexOf("?") + 1) : ""
			const params = _parseParams(paramsRaw_)
			const screen = url && url.includes("?") ? url.substring(0, url.indexOf("?")) : url
			return {screen, params}
		}
		const {screen, params} = _parseScreenUrl(screenUrl)

		return new QueuedUIInstruction(QueuedUIInstruction.TYPE__PUSHSCREEN, {screen_name: screen, params})
	}
	static createPopScreenInstruction() {
		return new QueuedUIInstruction(QueuedUIInstruction.TYPE__POPSCREEN, undefined)
	}
	static createUpdateScreenInstruction(screenId, updatedParamsSection) {
		return new QueuedUIInstruction(QueuedUIInstruction.TYPE__UPDATESCREEN, { screen_id: screenId, params: updatedParamsSection })
	}

	constructor(type, payload) {
		this.type_ = type
		this.payload_ = payload
	}

	isDelayInstruction() { return this.type_ === QueuedUIInstruction.TYPE__DELAY }
	isPushScreenInstruction() { return this.type_ === QueuedUIInstruction.TYPE__PUSHSCREEN }
	isPopScreenInstruction() { return this.type_ === QueuedUIInstruction.TYPE__POPSCREEN }
	isUpdateScreenInstruction() { return this.type_ === QueuedUIInstruction.TYPE__UPDATESCREEN }

	delayTimeMs() { return this.isDelayInstruction() ? parseFloat(this.payload_) : undefined }
	pushScreenScreenName() { return this.isPushScreenInstruction() ? this.payload_?.screen_name : undefined }
	pushScreenScreenParams() { return this.isPushScreenInstruction() ? this.payload_?.params : undefined }
	updateScreenScreenId() { return this.isUpdateScreenInstruction() ? this.payload_?.screen_id : undefined }
	updateScreenParams() { return this.isUpdateScreenInstruction() ? this.payload_?.params : undefined }

	type() { return this.type_ }
	payload() { return this.payload_ }
}

class GenericQueue {

	constructor() {
		this.elements_ = []
		this.c_head_ = -1 // consume head

		this._load()
	}

	_queueName() {
		return "some_queue"
	}

	__formattedQueueName() {
		let qn = this._queueName()
		qn = qn.replaceAll(" ", "_")
		return qn
	}

	_load() {
		const _qn = this.__formattedQueueName()

		this.elements_ = data[_qn] && data[_qn]?.data ? data[_qn].data : []
		this.c_head_ = data[_qn] && data[_qn]?.head_c ? data[_qn].head_c : 0
		return true
	}

	_save() {
		const _qn = this.__formattedQueueName()
		if (data[_qn] === undefined) {
			data[_qn] = {}
		}
		data[_qn].head_c = this.c_head_
		data[_qn].data = JSON.parse(JSON.stringify(this.elements_))
		return true
	}

	_push(element) {
		this.elements_.push(element)
		this._save()
	}
	_pop() {
		this.elements_.pop()
		this._save()
	}
	_remove(idx) {
		if (idx < 0 || idx >= this.elements_.length) {
			console.warn(`Could not remove element ${idx} from ${this._queueName()}, element does not exist`)
		}
		else {
			this.elements_.splice(idx, 1)
		}
	}

	size() { return this.elements_.length }
	consume() {
		console.log(`voi consuma din queue ${this.__formattedQueueName()}, elements: ${JSON.stringify(this.elements_)} si head: ${this.c_head_}`)
		if (this.c_head_ >= this.size()) return undefined
		const val = this.elements_[this.c_head_]
		this.c_head_ ++;
		this._save()
		return val
	}
}

class QueueE extends GenericQueue {
	constructor() {
		super()
	}

	_queueName() {
		return "queue_e"
	}

	pushEvent(ev) {
		console.log(`push event: ${JSON.stringify(ev)}`)
		return this._push(ev)
	}
}

class QueueU extends GenericQueue {
	constructor() {
		super()
	}

	_queueName() {
		return "queue_u"
	}

	pushInstruction(uiInstruction/*:QueuedUIInstruction*/) {
		this._push(uiInstruction)
	}
}

class ModelFactory {

	_singletonAccess(fname, instantiateClbk) {
		const field_ = fname.toLowerCase()
		if (this[field_] === undefined) {
			this[field_] = instantiateClbk()
		}
		return this[field_]
	}
	getModel(key) {
		switch(key.toLowerCase()) {
			default:
				return this._getModel(key)
		}
	}

	// to be overwritten methods
	_getModel(key) {
		key ? null : null // get rid of strict-mode error
		return null; // returns a Model instance of the 'key' model (key is the name of the model you want)
	}
}

//////////////////////////////////////////////////////////////////////
// classes that should be overwritten on the configurator.js file

// this object can interogate the C/U queues and can surpress (ignore) or concatenate UI instructions and modify the queue by will; it's a filter and optimizer
class UIQueueOptimizer {
	optimizeQueue(queueU) {
		queueU ? {} : {}
		return false // didn't do anything, queue is not touched
	}
}

// this should consume project-specific events and the effect should be model-changes + producing UI instructions in the U-queue
class EventsQueueConsumer {
	// asta NU se suprascrie
	consume(queueE/*:QueueE*/, queueU/*QueueU*/) {
		let ev, consumer;
		do {
			ev = queueE.consume(); if (!ev) break

			if (ev.isClickEvent()) {
				consumer = { _label: '_consumeClickCmd', f: (cmd, queueU) => this._consumeClickCmd(cmd, queueU) }
			}
			else if (ev.isAsyncEvent()) {
				consumer = { _label: '_consumeAsyncCmd', f: (cmd, queueU) => this._consumeAsyncCmd(cmd, queueU) }
			}
			else if (ev.isDatabindEvent()) {
				consumer = { _label: '_consumeDatabindCmd', f: (cmd, queueU) => this._consumeDatabindCmd(cmd, queueU) }
			}
			else {
				consumer = { _label: '_consumeGenericCmd', f: (cmd, queueU) => this._consumeGenericCmd(cmd, queueU) }
			}
			if (!consumer.f(ev, queueU)) {
				console.error(`Consumer ${consumer._label} was not able to consume event '${ev.type()}', payload: ${JSON.stringify(ev.payload())}`)
			}
		}
		while (ev !== undefined) // consum toata coada (continutul disponibil in prezent)
	}

	_getHelpers(ev, queueU) {
		return {
			buildScreenQuery: (screen, params) => {
				let p = ""
				if (Object.keys(params).length > 0) {
					for (let pp of Object.keys(params)) {
						p += `${pp}=${params[pp]}&`
					}
					p = p.substring(0, p.length - 1)
				}
				return `${screen}${p.length > 0 ? '?' + p : ''}`
			},

			schedulePushScreen: (screenUrl) => queueU.pushInstruction(QueuedUIInstruction.createPushScreenInstruction(screenUrl)),
			schedulePopScreen: () => queueU.pushInstruction(QueuedUIInstruction.createPopScreenInstruction()),
			scheduleDelay: (timeMs) => queueU.pushInstruction(QueuedUIInstruction.createDelayInstruction(timeMs)),
			scheduleUpdateScreen: (params) => queueU.pushInstruction(QueuedUIInstruction.createUpdateScreenInstruction(ev.sourceScreen().id, params)),
			routeDecisions: (routes) => {
				/*
					routes = [
						{
							scr: undefined|string 	// screenId
							elm: string				// sourceElement
							hndl: 					// handler
						}
					]
					*/
				const se = ev.clickSourceElement()?.toLowerCase()

				const scrUndefines = routes.filter(e => e?.scr === null || e?.scr === undefined)
				const completes = routes.filter(e => e?.scr !== null && e?.scr !== undefined)
				
				const seEqValid = (val) => (typeof val === "function" && val(se)) || (typeof val !== 'function' && !val && !se) || (typeof val !== 'function' && val?.toLowerCase() === se?.toLowerCase())

				for (let r of scrUndefines) {
					if (seEqValid(r.elm)) {
						r.hndl()
						return true
					}
				}
				
				const sourceScreen_ = ev.sourceScreen()
				const sourceScreenName = sourceScreen_.screen
				
				for (let r of completes) {
					if (sourceScreenName.toLowerCase() == r.scr.toLowerCase() && ((r.elm && seEqValid(r.elm)) || !r.elm)) {
						r.hndl()
						return true
					}
				}
				return false
			}
		}
	}

	////////////////////////////////////////////////
	// astea sa fie SUPRASCRISE
	_consumeClickCmd(cmd/*:QueuedEvent*/, queueU) {
		cmd ? {} : {}
		queueU ? {} : {}
		return false // not handled
	}
	_consumeAsyncCmd(cmd/*:QueuedEvent*/, queueU) {
		cmd ? {} : {}
		queueU ? {} : {}
		return false // not handled
	}
	_consumeDatabindCmd(cmd/*:QueuedEvent*/, queueU) {
		cmd ? {} : {}
		queueU ? {} : {}
		return false // not handled
	}
	_consumeGenericCmd(cmd/*:QueuedEvent*/, queueU) {
		cmd ? {} : {}
		queueU ? {} : {}
		return false
	}
}
/////////////////////////////////////////////////////////////////////

class ModelEvent {
	constructor(key, propOrOp, valOrPayload) {
		this.key = key
		this.propOrOp = propOrOp
		this.valOrPayload = valOrPayload
		
		//key is the model identifier, prop is the property/operation of/on the respective model, payload is the new data of the prop/data of the operation that is being applied to the model
	}
}

class UIEvent {
	constructor(uiElementId, evType="click", payload=undefined) {
		this.elementId_ = uiElementId
		this.evType_ = evType
		this.payload_ = payload
	}
	uiElementId() { return this.elementId_ }
	type() { return this.evType_ }
	payload() { return this.payload_ }
}

class VM {
	
	constructor() {
		this.pendingEvents_ = []
		this.listeners_ = []
		this.id_ = parseInt(Math.random() * 1000)
	}
	
	init() { // must be called by VM Factory immediately after the constructor; this can be overwritten and put some inherited logic in here, for initializing whole internal state
	}
	
	_initViewMeta() { // to be overriden, and specify view UI elements to be on/off
		return null
	}
	
	initView() { // initializes the View (Screen), by passing messages to it, for hiding/showing/formatting widgets on it, so that it will have the final form this VM expects it to have; in our case, the messages are ScriptAPI calls
	
		this._trigger("init_ui", this._initViewMeta())
		this.sendRefresh2View()
	}
	
	sendRefresh2View() {
		this._trigger("refresh", {}) // send refresh signal to View, which can interogate the viewmodel data, by calling data(), and then auto-refresh itself
	}
	
	uiEvent(ev) {
		ev ? null : null // get rid of strict-mode error
		// handles an ui event and return true/false if it was handled correctly (TODO: or transition ?!...)
	}
	
	modelEvent(ev) {
		ev ? null : null // get rid of strict-mode error
		// handles a model change event and returns true/false if it handled it or not
	}
	
	_data() { // TO BE overriden, sends relevant view-model data to the view
		
	}
	
	data() { // DO NOT EDIT
		return {
			'vmdata': this._data(),
			'vmmeta': this._initViewMeta()
		}
	}
	
	registerForVMChange(clbk) {
		this.listeners_.push(clbk)
	}
	
	_trigger(change, payload) {
		if (this.listeners_.length === 0) {
			this.pendingEvents_.push({change, payload})
			return 
		}
		
		const triggerIt = (change, payload) => {
			//console.log(`num listeners: ${this.listeners_.length}`)
			for (let clbk of this.listeners_) {
				if (clbk) {
					if (!clbk(change, payload)) {
						console.warn(`view did not completely handled vm event ${change}`)
					}
					//console.log(`clbk called...`)
				}
			}
		}
		if (this.pendingEvents_.length > 0) { // triggerring old scheduled events, for that time when no listener was active
			for (let pe of this.pendingEvents_) {
				triggerIt(pe.change, pe.payload)
			}
			this.pendingEvents_ = []
		}
		triggerIt(change, payload)
	}
}

class VMFactory {
	constructor() {
		this.vmrefs_ = {}
	}
	// it will also register the created VM to the current screen, for events, which, in turn, will also register the screen to the VM for VM-changes; BUT will let the VM register itself to the model, for certain changes
	
	_createVM(key, viewRef, params) { // key is the VM type you want // can use the screenRef.constructor.name
		key ? null : null // get rid of strict-mode error
		viewRef ? null : null // get rid of strict-mode error
		params ? null : null // get rid of strict-mode error
		return null; // it returns the newly created VM
	}
	
	__registerVM(key, viewRef, params) { // this should NOT be overwritten, only _createVM method
		const vm = this._createVM(key, viewRef, params)
		vm.init()
		return vm
	}
	
	getVM(key, viewRef, params, resetInstance=false) {
		const create_ = () => {
			return this.__registerVM(key.trim().toLowerCase(), viewRef, params)
		}
		const k = `${key.trim().toLowerCase()}_${viewRef.constructor.name.toLowerCase()}`
		if (resetInstance) {
			this.vmrefs_[k] = create_()
		}
		else {
			this.vmrefs_[k] = this.vmrefs_[k] ? this.vmrefs_[k] : create_()
		}
		return this.vmrefs_[k]
	}
}

class MVVMInputMessage {

}

class MVVMOutputMessage {

}

class MVVMInputModule {
	notify(ev) { // MVVMInputMessage type
		ev ? null : null
		// doing nothing, this method should be overriden by io_modules.js unit
	}
}

class MVVMOutputModule {
	sendMessage(payload) {
		payload ? null : null
		// doing nothing, but after being overriden by io_modules.js unit, it should build a MVVMOutputMessage and should send it to the responsible external module
	}
}

class PScreen { // projected screen

	constructor() {
		this.resetVMRetrieve_ = true
	}
	
	init() {
		const vm = this.getVM()
		if (vm) {
			vm.registerForVMChange((vmEvent, payload) => {
				switch (vmEvent?.toLowerCase()) {
					
					case "init_ui":
						// todo manage UI reconfiguration...
						this.configureUI(payload)
						return true
						
					case "refresh":
						this.refreshView()
						return true
						
					default:
						return this.applyVMChange(vmEvent, payload)
				}
			})
		}
		else {
			console.warn(`getVM() returns an invalid VM for screen ${this.constructor.name}`)
		}
	}

	onTransitionTo() {} // called only after the screen associated with this VM was pushed on the screen stack (it means you are on the first time on that screen or you returned on that screen)
	
	configureUI(params) {
		params ? {} : {}
	}
	
	screenId() { return null } // the qux screen id associated with the current screen class
	
	_getVM(resetFactoryInstance) { // should implement it as lazy get, using the VMFactory to create a VM, and also cache-ing it for later calls (like a "singleton" VM, using (other class's) this getVM method)
		resetFactoryInstance ? {} : {}
		return null;
	}
	
	getVM() {
		const vm = this._getVM(this.resetVMRetrieve_)
		this.resetVMRetrieve_ = false
		return vm
	}
	
	applyVMChange(vmEvent, payload) {
		vmEvent ? {} : {}
		payload ? {} : {}
	}
	refreshView() {
		
	}
	
	sendUIEvent(ev) {
		let vmSucceeded = false
		const vm = this.getVM()
		if (!vm) {
			console.warn(`current screen ${this.constructor.name} doesn't have a valid VM`)
		}
		else {
			vmSucceeded = vm.uiEvent(ev)
			if (!vmSucceeded) {
				console.warn(`uiEvent on the VM failed, for event ${JSON.stringify(ev)}`)
			}
		}
	}

	transitionValid() {} // checks if the actual context (previous screen, current UI event (pe)) are valid for this screen to appear
	
	//transitionTarget() { return null } // this instructs quantUX to instantiate this screen, next render time, when the context is ready (transitionValid) -- null means, the caller will decide what screen to instantiate (a default one)

	build() {
		if (!this.transitionValid()) return;
		this._ibuild()
	} // both methods are dealing with GUI contents, but this one is trigered only one time, before transitioning to the screen, and the second one, virtually any time you are modifying something in the model
}


class MVVM_UIUtils {

	parseWidgetIdx(name) {
        return parseInt(name.trim().slice(-1))
    }
    
	__hideIfExists(widgName, scr) {
		//console.log(`hiding: ${widgName}`)
		if (scr.groupExists(widgName)) {
			//console.log('exists: group')
			scr.getGroup(widgName).hide();
			//console.log('hidden')
			return true
		}
		else if (scr.widgetExists(widgName)) {
			//console.log('exists: widget')
			scr.getWidget(widgName).hide();
			//console.log('hidden')
			
			//scr.getWidget(widgName).setStyle({'background-color': 'yellow'})
			return true
		}
		return false
	}
	__showIfExists(widgName, scr) {
		//console.log(`showing: ${widgName}`)
		if (scr.groupExists(widgName)) {
			//console.log('exists: group')
			scr.getGroup(widgName).show();
			//console.log('shown')
			return true
		}
		else if (scr.widgetExists(widgName)) {
			//console.log('exists: widget')
			scr.getWidget(widgName).show();
			//console.log('shown')
			return true
		}
		return false
	}
	
	setVisibility(visible, widgName, scr) {
		if (visible) {
			return MVVM_CONTROLLER.UIUtils().__showIfExists(widgName, scr)
		}
		else {
			return MVVM_CONTROLLER.UIUtils().__hideIfExists(widgName, scr)
		}
	}

	title(tit) {
		//console.log(`setting title to ${tit}`)
		
		data.uimeta = {
			...data.uimeta,
			generic_list_title: tit
		};
	}
}


class TransitionController {
	uiEvent(screenRef, ev) { // will return class names (string)
		screenRef ? {} : {}
		ev ? {} : {}
		return "same"
	}
}


class ScreenFactory {
	instantiate_(scrCls, params) { return new scrCls(params) }
	
	screenIdFromClsName(clsName) {
		const scrInst = this.createScreen(clsName)
		return scrInst ? scrInst.screenId() : null
	}
	
	// to be overwritten
	createScreen(clsName, params) { clsName ? {} : {}; params ? {} : {}; return null }
	screenQuxLabelToClsName(screenQuxLabel) { screenQuxLabel ? {} : {}; return null }
}

class MVVMConfigurator {

	ModelFactory() { return null }
	VMFactory() { return null }

	TransitionController() { return null }
	EventsConsumer() { return null }

	UIOptimizer() { return null }
}


let MVVM_CONTROLLER = null; // will be later instantiated

class MVVMContext {
	
	__saveState() {
		data.screensStack = JSON.parse(JSON.stringify(this.screensStack_))
	}

	__generateId() {
		return Math.random() * 100000000
	}
	
	constructor() {
		
		this.screensStack_ = data.screensStack ? data.screensStack : []

		const quxScreenLabel_ = data?.__sourceScreen?.name
		const quxScreenClsName_ = quxScreenLabel_ ? MVVM_CONTROLLER.Configurator().ScreenFactory().screenQuxLabelToClsName(quxScreenLabel_) : undefined
		const lastStackedScreenClsName_ = this.lastScreen()?.screen

		console.log(`quxScreenLabel_: ${quxScreenLabel_};\nquxScreenClsName_: ${quxScreenClsName_};\nlastStackedScreenClsName_: ${lastStackedScreenClsName_}`)

		if (quxScreenClsName_ && quxScreenClsName_.toLowerCase() !== lastStackedScreenClsName_?.toLowerCase()) {
			console.log(`pushing screen ${quxScreenClsName_}`)
			this.pushScreen(quxScreenClsName_) // aici facem trecerea de la ecrane QUX de care MVVM nu stie (tranzitii netrecute prin MVVM) la logica MVVM; daca nu facem asta, atunci inconsistenta asta strica toata logica MVVM (chiar daca nu stiu ce alte tranzitii a facut QUX intre timp, fara MVVM, ma intereseaza acest ultim ecran) -- in general nu o idee prea buna mixul asta intre MVVM si QUX, dar e greu sa impl ceva foarte bine delimitat
		}
		
		// const lastScreenIsNotRegistered = (ps) => ps && this.lastScreen()?.screen && MVVM_CONTROLLER.Configurator().ScreenFactory().createScreen(this.lastScreen()?.screen, {})?.screenId()?.toLowerCase() !== ps.toLowerCase()
		// this will contain class names

		console.log(`screenStack: ${JSON.stringify(this.screensStack_)}`)
		
		// the first screen before this script is starting to run as a MVVM router, will not be registered here, unless we make this as a special case, like so:
		/*const ps = data.__sourceScreen ? data.__sourceScreen.toLowerCase() : undefined
		console.log(`screen from qux: ${ps}`)
		if (ps && (this.screensStack_.length <= 0 || lastScreenIsNotRegistered(ps))) {
			console.log(`screens empty, do we have a screen from QUX?: ${ps}`)
			const scr_ = MVVM_CONTROLLER.Configurator().ScreenFactory().screenQuxLabelToClsName(ps)
			if (scr_) {
				console.log(`pushing screen to stack MANUALLY: ${scr_}`)
				this.screensStack_.push({
					screen: scr_,
					params: {},

					id: this.__generateId(),
				})
				this.__saveState()
			}
			else {
				console.warn(`Detected unregistered screen (${ps}) but could not instantiate a cls name from it to add it into the screens stack`)
			}
		}*/
	}
	
	pushScreen(screenClsName, params) {
		this.screensStack_.push({
			screen: screenClsName,
			params,

			id: this.__generateId(),
		})
		this.__saveState()

		console.log(`screen stack changed to ${JSON.stringify(this.screensStack_)}`)
	}
	updateScreenParams(screenId, params) {
		const selection = this.screensStack_.filter(s => s.id == screenId)
		if (selection.length > 0) {
			const selScreen = selection[0]
			let cparams = selScreen.params
			for (let k of Object.keys(params)) {
				cparams[k] = params[k]
			}
			selScreen.params = cparams
			this.__saveState()
			return true
		}
		return false
	}

	screen(screenId) {
		const selection = this.screensStack_.filter(s => s.id == screenId)
		return selection.length > 0 ? selection[0] : undefined;
	}
	
	lastScreen() { return this.screensStack_.length >= 1 ? this.screensStack_[this.screensStack_.length - 1] : undefined }
	previousScreen() { return this.screensStack_.length >= 2 ? this.screensStack_[this.screensStack_.length - 2] : undefined }
	popLastScreen() { return this.screensStack_.pop() }
}

class MVVMController {
	
	constructor() {
		this.context_ = null
		this.uiUtils_ = new MVVM_UIUtils()

		this.queueE_ = new QueueE()
		this.queueU_ = new QueueU()
	}

	UIUtils() { return this.uiUtils_ }
	
	// le pun cu litera mare la inceput ca sa arat ca sunt functii, in mod special, publice ce se vrea a fi apelate din afara
	Configurator() { return null } // :MVVMConfigurator


	__private_helpers() {
		return {
			'buildScreenByRef': (screen, params, isPush = false) => {
				//const {screen, params} = MVVMStarter._parseScreenUrl(forceTransitionTo)
				const ns = this._instantiateScreen(screen, params)
				const nvm = ns.getVM()
				// console.log(`log1: 112 configured screen for next render, vm name ${nvm?.constructor?.name}`)
				if (isPush) ns.onTransitionTo()
				if (nvm) nvm.initView()
				// console.log(`log1: 111 initView done`)
				return ns
			},
			'buildCurrentScreen': (isPush = true) => {
				const {screen, params} = this.__context().lastScreen()
				return this.__private_helpers().buildScreenByRef(screen, params, isPush)
			},
			'buildScreen': (screenId, isPush = false) => {
				const {screen, params} = this.__context().screen(screenId)
				return this.__private_helpers().buildScreenByRef(screen, params, isPush)
			},
			'digestEvents': () => {
				this.Configurator().EventsConsumer().consume(this.queueE_, this.queueU_)
			},
			'sendEventToScreen': (ev) => {
				const screen = this.__private_helpers().buildScreen(ev.sourceScreen().id)
				screen.sendUIEvent(ev.toUIEvent())
			}
		}
	}

	pushClickEvent(sourceElement) {
		if (sourceElement === undefined) {
			// getting from data.__sourceElement and data.__sourceScreen instead
			sourceElement = data.__sourceElement?.name
		}
		const ev = QueuedEvent.Factory(this.__context()).createClickEvent(sourceElement)
		console.log(`ev_: ${JSON.stringify(ev)}`)
		this.__private_helpers().sendEventToScreen(ev)

		this.queueE_.pushEvent(ev)
		this.__private_helpers().digestEvents()
	}
	pushAsyncEvent(cmdId) {
		const ev = QueuedEvent.Factory(this.__context()).createAsyncEvent(cmdId)
		this.__private_helpers().sendEventToScreen(ev)

		this.queueE_.pushEvent(ev)
		this.__private_helpers().digestEvents()
	}
	pushDataBindEvent(databinding, value) {
		const ev = QueuedEvent.Factory(this.__context()).createDatabindEvent(databinding, value)
		this.__private_helpers().sendEventToScreen(ev)

		this.queueE_.pushEvent(ev)
		this.__private_helpers().digestEvents()
	}
	
	__context() {
		if (this.context_ === null) this.context_ = new MVVMContext()
		return this.context_
	}
	
	_instantiateScreen(screen, params) {
		// console.log(`log3: creating screen: ${screen} with params ${JSON.stringify(params)}`)
		const sref = MVVM_CONTROLLER.Configurator().ScreenFactory().createScreen(screen, params)
		sref.init()
		// console.log(`create screen ${screen} with params ${JSON.stringify(params)}`)
		return sref
	}
	_updateContextByTarget(ctx, targetScreen) {
		ctx.pushScreen(targetScreen)
		return ctx
	}
	
	// PUBLIC methods
	
	//lastScreenIs(screenCls) {
	//	const ctx = new MVVMContext()
	//	return ctx.lastScreen()?.screen === screenCls
	//}

	// this is the single function that needs to be called and return its results on the (mvvm-routing) JS script
	Compute() {
		const uiOptimizer = MVVM_CONTROLLER.Configurator().UIOptimizer()

		uiOptimizer.optimizeQueue(this.queueU_)
		let nextUIInstruction = this.queueU_.consume()
		if (nextUIInstruction && nextUIInstruction.isDelayInstruction() && this.queueU_.previousInstruction()?.isDelayInstruction()) {
			console.warn(`Invalid state, delay UI instruction after delay UI instruction; the last one will be ignored.`)
			nextUIInstruction = this.queueU_.consume()
		}

		// aici avem consumatorul de instructiuni UI din coada aferenta
		// logica e facuta asa:
		//    -- (1) push&pop screen sunt instructiuni cu efect imediat, deci vor returna de la sine un alt ecran catre QUX, decat cel curent
		//    -- (2) delay e singura instructiune care isi creaza automat legatura cu urmatoarea instructiune (caci instructiunile nu se executa daca QUX nu apeleaza acest Compute())
		//    -- (3) updateScreen e instructiune de sine statatoare, se presupune ca se refera la ecranul curent, si ca vrei sa actualizezi ceva in acesta; deci va fi executata si QUX va stii sa lase ecranul curent (doar il va actualiza, la nevoie)

		if (nextUIInstruction) { // daca e undefined, atunci inseamna ca ramanem pe acelasi ecran (nu mai avem nici o instructiune disponibila)

			// -1-apply updateScreen UI instruction
			if (nextUIInstruction.isUpdateScreenInstruction()) {
				this.__context().updateScreenParams(nextUIInstruction.updateScreenScreenId(), nextUIInstruction.updateScreenParams())

				console.log(`UI INSTRUCTION consumed: screen UPDATE `)
				return {} // acelasi ecran, fiindca am aplicat o comanda UI de sine statatoare
			}
			
			// -2-apply delay UI instruction
			if (nextUIInstruction.isDelayInstruction()) {

				console.log(`UI INSTRUCTION consumed: screen DELAY `)
				return {delay: nextUIInstruction.delayTimeMs()} // comanda QUX care face un setTimeout si apoi apeleaza iar functia curenta, pentru a prelua urmatoarea comanda din UI; comanda de delay curenta s-a popuit deja aici mai inainte
			}

			// -3- apply push&pop screen UI instructions
			let isPush = false
			if (nextUIInstruction.isPushScreenInstruction()) {
				isPush = true

				console.log(`UI INSTRUCTION consumed: screen PUSH ${nextUIInstruction.pushScreenScreenName()}`)
				this.__context().pushScreen(nextUIInstruction.pushScreenScreenName(), nextUIInstruction.pushScreenScreenParams())
			}
			else if (nextUIInstruction.isPopScreenInstruction()) {
				console.log(`UI INSTRUCTION consumed: screen POP`)

				this.__context().popLastScreen()
			}
			const builtScreen = this.__private_helpers().buildCurrentScreen(isPush)

			const ret = {targetTo: MVVM_CONTROLLER.Configurator().ScreenFactory().screenIdFromClsName(builtScreen.constructor.name)}
			console.log(`UI INSTRUCTION (${JSON.stringify(nextUIInstruction)}) consumed: current screen built; returning ${JSON.stringify(ret)}`)
			return ret
		}
		else {
			// vom returna cum ca trebuie sa ramana ecranul curent, deci QUX sa nu faca nimic
			console.log(`NO next UI instruction: returning {} (same screen: ${this.__context().lastScreen()?.screen})`)
			return {}
		}
		
		// de fapt, le voi apela lazy atunci cand inserez o comanda in queue-urile de comenzi
		//cmdOptimizer.optimizeQueue(queueC)
		//cmdConsumer.consumeCommand(cmd)

		// aici ce fac ?, preiau urmatoarea comanda din UICommand, si o execut (push screen, pop screen, delay); returnez la QUX ce trebuie, dupa ce instantiez ecranul respectiv

		/*const mode = params && typeof params !== 'string' ? params.mode : (typeof params === "string" ? params : "default")
		const asyncEvId = params && typeof params !== 'string' ? params.asyncEvId : null
		const popLastScreen = params && typeof params !== 'string' ? params.popLastScreen : null
		const forceTransitionTo = params && typeof params !== 'string' ? params.forceTransitionTo : null
		
		console.log(`computation mode: ${mode}; asyncEvId: ${asyncEvId} popLastScreen: ${popLastScreen}; force transition to: ${forceTransitionTo}`)
		
		const ctx = this.buildContext(asyncEvId)
		console.log(`ctx screens: ${JSON.stringify(ctx.screensStack_)}; \n${JSON.stringify(data.screensStack)}`)
		if (!ctx.valid()) {
			return {ignore: "dummy"}
		}
		
		if (forceTransitionTo) {
			const {screen, params} = MVVMStarter._parseScreenUrl(forceTransitionTo)
			ctx.pushScreen(screen, params)
			const ns = this._instantiateScreen(ctx)
			const nvm = ns.getVM();
			console.log(`log1: 112 configured screen for next render, vm name ${nvm?.constructor?.name}`)
			if (nvm) nvm.onTransitionTo()
			if (nvm) nvm.initView()
			console.log(`log1: 111 initView done`)
			let target = {to: MVVM_CONTROLLER.Configurator().ScreenFactory().screenIdFromClsName(screen)}
			return {...target, ...ctx.screenMeta(screen)}
		}
		else if (popLastScreen) {
			ctx.popLastScreen()
			const {screen, params} = ctx.lastScreen()
			console.log(`log4: poplastscreen`)
			let target = {to: MVVM_CONTROLLER.Configurator().ScreenFactory().screenIdFromClsName(screen)}
			target = {...target, ...ctx.screenMeta(screen)}
			if (target.to) {
				ctx.pushScreen(screen, params)
				const ns = this._instantiateScreen(ctx)
				const nvm = ns.getVM();
				console.log(`log1: 111 configured screen for next render, vm name ${nvm?.constructor?.name}`)
				if (nvm) nvm.onTransitionTo()
				if (nvm) nvm.initView()
				console.log(`log1: 111 initView done`)
			}
			return target
		}
		else {
			const s = this._instantiateScreen(ctx) // s este folosit numai pentru sendUIEvents, ATAT, configurarea se face mai jos...
			//const vm = s.getVM();// if (vm) vm.initView()
				
			console.log(`log1: screen instantiated`)
			
			let nextScreenCls = this._sendUIEvents(s, ctx.controller().consumeLastEvent()) // should also send it to the navigation-controller
			
			//if (mode.toLowerCase() === "no-transition") {
			//	ctx.saveDataBindingsState()
			//	return null
			//}
			console.log(`nextScreenCls: ${nextScreenCls}`)
			
			let params = {}
			if (!nextScreenCls) {
				return null
			}
			
			let noPush = false
			if (nextScreenCls.toLowerCase() === "same_screen") {
				const ls_ = ctx.lastScreen()
				params = ls_.params
				nextScreenCls = ls_.screen
				noPush = true
				
				console.log(`log1: same-screen: ${ls_.screen}`)
			}
			else {
				// here, the "same" ret-code should be interpretted as loop="something", to refresh the same screen again
				const ns__ = MVVMStarter._parseScreenUrl(nextScreenCls)
				nextScreenCls = ns__.screen
				params = ns__.params
				
				console.log(`log1: normal screen transition to ${nextScreenCls}, params: ${JSON.stringify(params)}`)
			}
			
			console.log(`screen: ${s?.constructor.name}`)
			console.log(`nextScreenCls1: ${nextScreenCls}`)
			
			let target = !nextScreenCls || nextScreenCls.trim().toLowerCase() === "same" ? {loop: "fast_exit"} : {to: MVVM_CONTROLLER.Configurator().ScreenFactory().screenIdFromClsName(nextScreenCls)}
			target = {...target, ...ctx.screenMeta(nextScreenCls)}
			// no need to push the new screen to the stack, it will be auto-added next time we instantiate the context, from the qux ScriptMixin ("qux controller")
			
			console.warn(`target: ${JSON.stringify(target)}`)
			
			if (target.to) {
				console.log(`log1: target.to: ${target.to}`)
				
				if (!noPush) {
					console.log(`log1: pushing screen on stack`)
					ctx.pushScreen(nextScreenCls, params)
				}
				const ns = this._instantiateScreen(ctx)
				const nvm = ns.getVM();
				console.log(`log1: configured screen for next render, vm name ${nvm?.constructor?.name}`)
				if (!noPush && nvm) nvm.onTransitionTo()
				if (nvm) nvm.initView()
				console.log(`log1: initView done`)
			}
		
			console.warn(`returning target: ${JSON.stringify(target)}`)
			return target
		}*/
	}
}

//REMOVE FROM HERE
// get rid of strict-mode errors 
const dummy0 = new Model()
const dummy1 = new ModelFactory()
const dummy2 = new ModelEvent()
const dummy3 = new UIEvent()
const dummy4 = new VM()
const dummy5 = new VMFactory()
const dummy6 = new MVVMInputMessage()
const dummy7 = new MVVMOutputMessage()
const dummy8 = new MVVMInputModule()
const dummy9 = new MVVMOutputModule()
const dummy10 = new PScreen();
const dummy11 = new MVVM_UIUtils();
const dummy12 = new TransitionController();
const dummy13 = new ScreenFactory();
const dummy14 = new MVVMConfigurator();
const dummy15 = new MVVMContext();
const dummy16 = new MVVMController();
const dummy17 = new QueuedEvent();
const dummy18 = new QueuedUIInstruction();
const dummy19 = new QueueE();
const dummy20 = new QueueU();
const dummy21 = new UIQueueOptimizer();
const dummy22 = new EventsQueueConsumer();
dummy0 ? null : null
dummy1 ? null : null
dummy2 ? null : null
dummy3 ? null : null
dummy4 ? null : null
dummy5 ? null : null
dummy6 ? null : null
dummy7 ? null : null
dummy8 ? null : null
dummy9 ? null : null
dummy10 ? null : null
dummy11 ? null : null
dummy12 ? null : null
dummy13 ? null : null
dummy14 ? null : null
dummy15 ? null : null
dummy16 ? null : null
dummy17 ? null : null
dummy18 ? null : null
dummy19 ? null : null
dummy20 ? null : null
dummy21 ? null : null
dummy22 ? null : null
}

export const code = codeFunction.toString().match(/function[^{]+\{([\s\S]*)\}$/)[1]

//code ? null : null