import { Inject, Injectable, Injector } from '@angular/core';
import { AccountsManager } from 'accounts-manager';
import { AlertType, ConnectionId, IBaseItem, Id, WebSocketService, WSEventType } from 'communication';
import { Feed, IInstrument, OnUpdateFn, UnsubscribeFn } from 'trading';
import { RealtimeType } from './realtime';
import { MessageTypes } from 'notification';

export enum WSMessageTypes {
  SUBSCRIBE = 'subscribe',
  UNSUBSCRIBE = 'unsubscribe',
  SUBSCRIBE_L2 = 'subscribeL2',
  UNSUBSCRIBE_L2 = 'unsubscribeL2',
}

@Injectable()
export class RealFeed<T, I extends IBaseItem = any> implements Feed<T> {
  type: RealtimeType;
  private _subscriptions: {
    [connectionId: string]: {
      [instrumentId: string]: {
        count: number,
        payload: object,
      }
    }
  } = {};
  private _unsubscribeFns = {};
  private _executors: OnUpdateFn<T> [] = [];

  subscribeType: WSMessageTypes;
  unsubscribeType: WSMessageTypes;

  private _pendingRequests = {} as any;

  constructor(
    protected _injector: Injector,
    @Inject(WebSocketService) protected _webSocketService: WebSocketService,
    @Inject(AccountsManager) protected _accountsManager: AccountsManager,
  ) {
    this._webSocketService.on(WSEventType.Message, this._handleUpdate.bind(this));
  }

  on(fn: OnUpdateFn<T>): UnsubscribeFn {
    this._executors.push(fn);

    return () => {
      this._executors = this._executors.filter(executor => executor !== fn);
    };
  }

  subscribe(data: I | I[], connectionId: Id) {
    this._sendRequest(this.subscribeType, data, connectionId);
  }

  unsubscribe(data: I | I[], connectionId: Id) {
    this._sendRequest(this.unsubscribeType, data, connectionId);
  }

  private _sendRequest(type: WSMessageTypes, data: I | I[], connectionId: Id) {
    const items = Array.isArray(data) ? data : [data];

    items.forEach(item => {
      if (!item)
        return;

      const subscriptions = this._subscriptions;
      if (!subscriptions[connectionId])
        subscriptions[connectionId] = {} as any;

      if (!subscriptions[connectionId][item.id])
        subscriptions[connectionId][item.id] = {} as any;

      if (type === this.subscribeType) {
        if (!subscriptions[connectionId][item.id]?.hasOwnProperty('count'))
          subscriptions[connectionId][item.id] = {} as any;

        const subs =  subscriptions[connectionId][item.id];
        subs.count = (subs?.count || 0) + 1;
        if (subs.count === 1) {
          const dto = { Value: [item], Timestamp: new Date() };

          if (!this._unsubscribeFns[connectionId])
            this._unsubscribeFns[connectionId] = {};

          this._unsubscribeFns[connectionId][item.id] = () =>
            this._webSocketService.send({ Type: this.unsubscribeType, ...dto }, connectionId);
          subs.payload = dto;
          const connection = this._accountsManager.getConnection(connectionId);

          if (connection?.connected)
            this._webSocketService.send({ Type: type, ...dto }, connectionId);
          else
            this.createPendingRequest(type, dto, connectionId);
        }
      } else {
        const subs = subscriptions[connectionId][item.id];
        if (!subs)
          return;

        subs.count = (subs?.count || 1) - 1;
        if (subs.count === 0) {
          if (this._unsubscribeFns[connectionId] && this._unsubscribeFns[connectionId][item.id]) {
            this._unsubscribeFns[connectionId][item.id]();
            delete this._unsubscribeFns[connectionId][item.id];
          }
        }
      }
    });
  }

  private createPendingRequest(type, payload, connectionId) {
    if (this._pendingRequests[connectionId] == null)
      this._pendingRequests[connectionId] = [];

    this._pendingRequests[connectionId].push(() => this._webSocketService.send({ Type: type, ...payload }, connectionId));
  }

  protected _getHash(instrument: IInstrument, connectionId: Id) {
    return `${ connectionId }/${ instrument.id }`;
  }

// protected _getFromHash(hash: string): I {
//   const [symbol, exchange] = hash.split('.');

//   return {
//     symbol,
//     exchange
//   } as any;
// }

  protected _onSucessfulyConnect(connectionId: Id) {
    const pendingRequests = this._pendingRequests[connectionId];
    if (!pendingRequests)
      return;

    pendingRequests.forEach(fn => fn());
    this._pendingRequests[connectionId] = [];
  }

  _onDisconnect(connectionId: Id) {
    const subscriptions = this._subscriptions[connectionId];
    if (!subscriptions)
      return;

    this._pendingRequests[connectionId] = [];
    Object.values(subscriptions)
      .map(item => this.createPendingRequest(WSMessageTypes.SUBSCRIBE, item.payload, connectionId));
  }

  protected _handleUpdate(data, connectionId: Id): boolean {
    const { type, result } = data;

    if (type == 'Message' && result.value == 'Api-key accepted!') {
      this._onSucessfulyConnect(connectionId);
      return;
    }

    if (type === MessageTypes.CONNECT && result.connectionId === ConnectionId.MarketData && result.type == AlertType.ConnectionClosed) {
      console.log('disconnect', connectionId);
      this._onDisconnect(connectionId);
    }

    if (type !== this.type || !result || !this._filter(result))
      return;

    const _result = this._getResult(data);

    for (const executor of this._executors) {
      try {
        _result.connectionId = connectionId;
        executor(_result, connectionId);
      } catch (error) {
        console.error('_handleTrade', error);
      }
    }
    return true;
  }

  protected _getResult(data) {
    const { result } = data;
    return this._map(result);
  }


  protected _filter(item: T): boolean {
    return true;
  }

  protected _map(item: T): any {
    return item;
  }

  merge(oldItem: I, newItem: I): I {
    return newItem;
  }
}

