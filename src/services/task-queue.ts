export class TaskQueue {
	private queue: (() => Promise<any>)[] = [];
	private working = false;

	constructor() {}

	private runNextInQueue() {
		this.working = true;
		const currentFn = this.queue.shift();

		const finishFn = () => {
			if (this.queue.length == 0) {
				this.working = false;
			} else {
				this.runNextInQueue();
			}
		};

		currentFn().then(finishFn).catch(finishFn);
	}

	queueTask(fn: () => Promise<any>) {
		this.queue.push(fn);
		if (!this.working) this.runNextInQueue();
		return this.queue.length; // if its first, will return 0
	}
}
