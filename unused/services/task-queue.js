"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskQueue = void 0;
class TaskQueue {
    queue = [];
    working = false;
    constructor() { }
    runNextInQueue() {
        this.working = true;
        const currentFn = this.queue.shift();
        const finishFn = () => {
            if (this.queue.length == 0) {
                this.working = false;
            }
            else {
                this.runNextInQueue();
            }
        };
        currentFn().then(finishFn).catch(finishFn);
    }
    queueTask(fn) {
        this.queue.push(fn);
        if (!this.working)
            this.runNextInQueue();
        return this.queue.length; // if its first, will return 0
    }
}
exports.TaskQueue = TaskQueue;
