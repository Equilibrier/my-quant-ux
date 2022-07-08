
import Services from "services/Services"

class DIProvider {
    constructor() {
        this._canvas = null;
        this._model = null;
        this._route = null;

        const f = async () => {
            await this.__waitUntil(() => this._route !== null, this._route, 5000);
            if (this._route !== null) {
                const modelService = Services.getModelService(this._route);
                let id = this._route.params.id;
                this._model = await modelService.findApp(id);
            }
            else {
                console.error("DIProvider: _route was not properly fed in 5 secs");
            }
        };
        f();
    }

    __set(fieldName) {
        return (value) => {
            if (this[fieldName] === null) {
                this[fieldName] = value;
            }
            else {
                console.warn(`DIProvider: ${fieldName} was already set...`);
            }
        }
    }

    __waitUntil = (checkedField, timeoutMs = -1) => {
        let periodMs = 100;
        const condition = () => this[checkedField] !== null;

        return new Promise((resolve) => {
            let countMs = 0;
            let interval = setInterval(() => {
                if (countMs >= timeoutMs) {
                    console.error(`DIProvider: timeout of ${timeoutMs} ms reached trying to wait for condition ${condition}`);

                    clearInterval(interval)
                    resolve(null);
                }
                if (!condition()) {
                    countMs += periodMs;
                    return
                }
                clearInterval(interval)
                resolve(this[checkedField])
            }, periodMs);
        })
    }

    setCanvas(canvas) {
        this.__set("_canvas")(canvas);
    }
    setModel(model) {
        console.error("Am setat modelul");
        this.__set("_model")(model);
    }
    setRoute(route) {
        this.__set("_route")(route);
    }

    canvas() { return this._canvas; }
    async canvasAsync() { return await this.__waitUntil('_canvas', 3000); }
    
    model() { return this._model; }
    async modelAsync() { return await this.__waitUntil('_model', 3000); }
}

export default new DIProvider();