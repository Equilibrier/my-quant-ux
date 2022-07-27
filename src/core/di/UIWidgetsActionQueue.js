
import Animation from 'core/Animation'
import DIProvider from 'core/di/DIProvider'

export class UIWidgetsActionQueue {

    constructor(renderFactory = null) {
        this.queue = {}
        this.noActionsNotifsPending = {}
        this.currentPendingActions = {}
        this.renderFactory = renderFactory;
    }

    setRenderFactory(ref) {
        this.renderFactory = ref;
    }

    async pushAction(widgetId, action, payload, clbk = (action, payload) => {console.log(`${action?"":""}${payload?"":""}`)}) {
        console.warn(`pushAction(${widgetId}, ${action}, ${payload})...`)

        if (this.renderFactory) {
            const widg = this.renderFactory.getUIWidget({id: widgetId})
            if (widg) {
                console.warn(`...consuming the action right now`)
                if (await this.__consumeAction(widg, action, payload, widgetId)) {
                    clbk(action, payload);
                }
                this.__notifyNoAction(action)
                return true;
            }
        }
        this.queue[widgetId] = this.queue[widgetId] ? this.queue[widgetId] : [];
        this.queue[widgetId].push({
            action,
            payload,
            clbk
        });
        console.warn(`...postponing the action`)
        return false; // false means scheduled for later execution...
    }

    actionsPendingCount(action) {
        let count = 0
        const allActions = [].concat.apply([], Object.values(this.queue))
        for (let act of allActions) {
            if (act.action.toLowerCase() === action.toLowerCase()) {
                count ++
            }
        }
        return count;
    }

    registerNoMoreActionsListener(action, clbk = () => {}) {
        if (!this.actionsPendingCount(action) && Object.values(this.currentPendingActions).filter(e => Object.values(e).length > 0).length <= 0) {
            clbk()
            return
        }
        this.noActionsNotifsPending[action] = this.noActionsNotifsPending[action] ? this.noActionsNotifsPending[action] : []
        this.noActionsNotifsPending[action].push(clbk)
    }

    async __consumeAction(widget, action, payload, widgetId = -1) {

        const createAnimation = (animFactory, event) => {
            const getAnimationMixedRot = (fromRot, toRot, p) => {
                var f = (1 - p);
                var mixed = fromRot + (toRot - fromRot) * f;
                return mixed;
            }
            const getAnimationMixedScale = (fromScale, toScale, p) => {
                var f = (1 - p);
                var sx = fromScale.sx + (toScale.sx - fromScale.sx) * f;
                var sy = fromScale.sy + (toScale.sy - fromScale.sy) * f;
                return {sx,sy};
            }

            var anim = animFactory.createAnimation();
            anim.duration = event.duration;
            anim.delay = event.delay;
            anim.event = event;
            if (event.easing) {
                anim.setEasing(event.easing);
            }


            var fromStyle = event.from.style;
            var fromPos = event.from.pos;
            var toStyle = event.to.style;
            var toPos = event.to.pos;
            var fromRot = event.from.rot
            var toRot = event.to.rot
            var fromScale = event.from.scale
            var toScale = event.to.scale

            console.log(`postrot: from: ${fromRot}, to: ${toRot}`)


            var me = animFactory;
            anim.onRender(p => {
                if (widget) {
                    try {
                        if (toStyle) {
                            //console.error(`\n*********************fromStyle: ${JSON.stringify(fromStyle)}; toStyle: ${JSON.stringify(toStyle)}\n******************************`)
                            var mixedStyle = me.getAnimationMixedStyle(fromStyle, toStyle, p);
                            widget.setAnimatedStyle(mixedStyle);
                        }

                        if (toPos && fromPos) {
                            var mixedPos = me.getAnimationMixedPos(fromPos, toPos, 1 - p);
                            mixedPos.x += event.posOffset.x
                            mixedPos.y += event.posOffset.y
                            widget.setAnimatedPos(mixedPos, mixedStyle);

                            const {tx,ty} = {
                                tx: mixedPos.x,
                                ty: mixedPos.y
                            }
                            // console.error(`updating dom for widget id '${widgetId}'...`)
                            DIProvider.tempModelContext().update(widgetId, {tx,ty})
                            DIProvider.tempModelContext().update(widgetId, {postStyle: mixedStyle})
                        }

                        if (toRot && fromRot) {
                            var mixedRot = getAnimationMixedRot(fromRot, toRot, 1 - p)
                            widget.setAnimatedRot(mixedRot)

                            DIProvider.tempModelContext().update(widgetId, {rotAngDegrees: mixedRot})
                        }

                        if (toScale && fromScale) {
                            var mixedScale = getAnimationMixedScale(fromScale, toScale, 1 - p)
                            console.log(`cosmin: postscale-anim: ${JSON.stringify(mixedScale)}`)
                            widget.setAnimatedScale(mixedScale.sx, mixedScale.sy)

                            DIProvider.tempModelContext().update(widgetId, {sx: mixedScale.sx, sy: mixedScale.sy})
                        }

                    } catch (e) {
                        console.error("WidgetAnimation.render() >  ", e);
                        console.error("WidgetAnimation.render() >  ", e.stack);
                    }
                }
            })

            return anim;
        }

        return new Promise((resolve, reject) => {

            console.log(reject ? "" : "")

            this.currentPendingActions[action] = this.currentPendingActions[action] ? this.currentPendingActions[action] : {}
            this.currentPendingActions[action][widgetId] = 'just-a-maker'

            if (action.toLowerCase() === "translate" || action.toLowerCase() === "rotate" || action.toLowerCase() === "scale") {
                widget.postTransform(payload);
                delete this.currentPendingActions[action][widgetId]
                resolve(true)
            }
            else if (action.toLowerCase() === "animate") {
                const animEvent = {
                    duration: payload.durationMs,
                    delay: payload.delayMs,
                    from: {
                        style: payload.styleFrom,
                        pos: payload.posFrom,
                        rot: payload.rotDegFrom,
                        scale: payload.scaleFrom
                    },
                    to: {
                        style: payload.styleTo,
                        pos: payload.posTo,
                        rot: payload.rotDegTo,
                        scale: payload.scaleTo
                    },
                    posOffset: payload.posOffset
                }
    
                var animFactory = new Animation();
                //var anim = animFactory.createWidgetAnimation(widget, animEvent);
                var anim = createAnimation(animFactory, animEvent);
    
                anim.run()
                console.error(`anim.run-----`)
                //anim.onEnd(lang.hitch(this, "onAnimationEnded", e.id));
                anim.onEnd(() => {
                    delete this.currentPendingActions[action][widgetId]
                    resolve(true)
                })
            }
            else {
                console.warn(`widget action '${action}' (with payload "${JSON.stringify(payload)}") for widget id ${widgetId} is unknown and it was ignored...`);
                delete this.currentPendingActions[action][widgetId]
                resolve(false)
            }
        });
    }

    __notifyNoAction(action) {
        if (this.noActionsNotifsPending[action]) {
            if (!this.actionsPendingCount(action)) {
                console.warn(`NOTIFYING no-action...`)
                for (let noaClbk of this.noActionsNotifsPending[action]) {
                    noaClbk()
                }
                this.noActionsNotifsPending[action] = []
            }
        }
    }

    async consumeActions(widgetId, widget, doneClbk = () => {}, beforeClbk = () => {}) {
        
        beforeClbk()

        const scheduled = this.queue[widgetId];
        if (!scheduled) { doneClbk(); return }

        while (scheduled.length > 0) {
            const sched = scheduled.shift(); // pop-first
            const action = sched.action;
            const payload = sched.payload;
            const clbk = sched.clbk;
            if (await this.__consumeAction(widget, action, payload, widgetId)) {
                clbk(action, payload);
            }
            this.__notifyNoAction(action)
        }

        doneClbk();

    }
}