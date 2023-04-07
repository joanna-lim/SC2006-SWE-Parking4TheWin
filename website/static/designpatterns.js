// Subject-Object Design Pattern implemented using function callbacks
export class Subject {
    constructor() {
        this.callbacks = [];
    }

    addObserver(observer, callbackType, callback) {
        this.callbacks.push({ observer: observer,
                              callbackType: callbackType,
                              callback: callback});
    }

    removeObserver(observer) {
        this.callbacks = this.callbacks.filter(c => c.observer !== observer);
    }

    notifyObservers(data, callbackType) {
        this.callbacks.filter(observer => observer.callbackType === callbackType)
                      .forEach(observer => observer.callback(data));
    }
}