import { Injectable } from '@angular/core';
import { IInstrument, ITrade } from 'trading';
import { RealFeed, WSMessageTypes } from './real-feed';
import { RealtimeType } from './realtime';

@Injectable()
export class RealLevelTwoDataFeed extends RealFeed<any, IInstrument>{
  type = RealtimeType.Level2;
  subscribeType = WSMessageTypes.SUBSCRIBE_L2;
  unsubscribeType = WSMessageTypes.SUBSCRIBE_L2;

  protected _filter(trade: ITrade) {
    // return !isNaN(trade.askInfo.price) && !isNaN(trade.bidInfo.price);
    return true;
  }
}

