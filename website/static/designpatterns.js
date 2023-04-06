// Subject-Object Design Pattern implemented using function callbacks
export class Subject {
    constructor() {
        this.observers = [];
    }

    addObserver(observer, callbackType, callback) {
        this.observers.push({ observer: observer,
                              callbackType: callbackType,
                              callback: callback});
    }

    removeObserver(observer) {
        this.observers = this.observers.filter(obs => obs !== observer);
    }

    notifyObservers(data, callbackType) {
        this.observers.filter(observer => observer.callbackType === callbackType)
                      .forEach(observer => observer.callback(data));
    }
}