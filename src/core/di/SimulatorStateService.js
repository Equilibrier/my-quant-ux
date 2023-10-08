import DIProvider from 'core/di/DIProvider'

export class SimulatorStateService {

    constructor() {
        this.listeners_ = []
        this.started_ = false
        this.mnService_ = DIProvider.mvvmNotificationsService()

        this.__private = {
            'acknowledge': () => { for (let l of this.listeners_) l(this.started_) }
        }
    }

    registerListener(clbk) { // should be function with only one parameter, a boolean, specifying if the simulator is started or not
        if (clbk) this.listeners_.push(clbk)
    }

    emitStarted() {
        if (this.started_) { console.warn(`SimulatorStateService: simulator already (acknowledged as) started`); return }

        DIProvider.mvvmQueriesService().clearQueue()
        
        //DIProvider.executeMvvm("MVVM_CONTROLLER.loadInitialData()")
        
        this.started_ = true
        this.__private.acknowledge()
        
        this.mnService_.discardQueue()
        this.mnService_.startListening()
    }
    emitStopped() {
        if (!this.started_) { console.warn(`SimulatorStateService: simulator already (acknowledged as) stopped`); return }

        this.started_ = false
        this.__private.acknowledge()

        this.mnService_.stopListening()
    }

    started() { return this.started_ }
}