import { RealFeed, WSMessageTypes } from './real-feed';
import { IInstrument, OnTradeFn, SettleData, UnsubscribeFn } from 'trading';
import { RealtimeType } from './realtime';

export class RealSettleDataFeed extends RealFeed<SettleData, IInstrument> {
  type = RealtimeType.Settle;
  _lastValue: SettleData;

  subscribeType = WSMessageTypes.SUBSCRIBE;
  unsubscribeType = WSMessageTypes.UNSUBSCRIBE;

  on(fn: OnTradeFn<SettleData>): UnsubscribeFn {
    if (this._lastValue != null) {
      fn(this._lastValue);
    }
    return super.on(fn);
  }

  protected _handleTrade(data, connectionId) {
    const result = super._handleTrade(data, connectionId);
    if (result) {
      // #TODO save last value by connection id and instrument
      this._lastValue = this._getResult(data);
      return true;
    }
  }
}
