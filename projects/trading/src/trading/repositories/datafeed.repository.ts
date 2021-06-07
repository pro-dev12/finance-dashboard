import { Id } from "communication";
import { ConnectionsFactory } from "../../../../real-trading/src/trading/repositories/connections.factory";
import { IInstrument } from "../models";
import { OnTradeFn } from "./feed";

type UnsubscribeFn = () => void;
type SubscribeFn = (quote: any) => void;

class Subscription {
    executable = false;
    constructor(private _fn: SubscribeFn) {
        this.executable = typeof _fn == 'function';
    }

    execute(quote: any) {
        this._fn(quote);
    }
}

export abstract class DatafeedRepository<T> extends ConnectionsFactory {
    protected _subscribers = new Map<Id, Subscription[]>();
    protected _quoteSubscribers = [];

    subscribe(instrument: IInstrument, connectionId?: Id): UnsubscribeFn {
        const instruemntId = instrument?.id;
        if (instruemntId == null)
            throw new Error('Please provide valid instrument');

        if (!this._subscribers.has(instruemntId)) {
            this._subscribers.set(instruemntId, [])
            this._subscribe(instruemntId);
        }

        // const subscription = new Subscription(fn);
        // this._subscribers.get(instruemntId).push(subscription);

        return () => {
            // const subscribers = this._subscribers.get(instruemntId);
            // if (!Array.isArray(subscribers) || !subscribers.length)
            //     return;

            // const newSubscribers = subscribers.filter(i => i != subscription);
            // this._subscribers.set(instruemntId, newSubscribers);

            // if (!newSubscribers.length)
            //     this._unsubscribe(instruemntId);
        };
    }

    unsubscribe(instrument: IInstrument) {
        console.log('unsubscribe', instrument);
    }

    on(fn: OnTradeFn<T>): UnsubscribeFn {
        this._quoteSubscribers.push(fn);

        return () => this._quoteSubscribers.filter(i => i != fn);
    }

    protected _triggerQuotes(quotes: any[]) {
        for (const fn of this._quoteSubscribers)
            fn(quotes);

        // for (const quote of quotes)
        //     this._subscribers.get(quote.instrument.id).forEach(s => s.executable && s.execute(quote));
    }

    protected abstract _subscribe(instruemntId: Id);
    protected abstract _unsubscribe(instruemntId: Id);
}
