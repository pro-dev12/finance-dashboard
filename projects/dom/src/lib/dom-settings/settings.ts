import { Column } from 'data-grid';
import * as merge from 'deepmerge';
import { TextAlign } from 'dynamic-form';
import { HistogramOrientation } from './settings-fields';
import { KeyBinding, KeyBindingPart, KeyCode } from 'keyboard';

function getKeyBindings(keyCodes = []) {
  return new KeyBinding(keyCodes.map(item => KeyBindingPart.fromKeyCode(item))).toDTO();
}

export class DomSettings {
  public set columns(value: Column[]) {
    this._columns = value;
    this._setDataToColumns();
  }

  private _columns: Column[] = [];

  public get columns(): Column[] {
    return this._columns;
  }

  general: any = {
    allWindows: false,
    autoCenter: false,
    centerLine: false,
    clearCurrentTrades: false,
    clearTotalTrades: false,
    closeOutstandingOrders: false,
    commonView: { autoCenterTicks: 10, ticksPerPrice: 5 },
    marketDepth: {
      bidAskDeltaDepth: 9, marketDepth: 9,
      showDepthHistory: false,
      bidAskDeltaFilter: 8
    },
    digitsToHide: 6,
    hideAccountName: true,
    hideFromLeft: true,
    hideFromRight: true,
    intervals: {
      clearTradersTimer: 8,
      updateInterval: 8,
      orderQuantityStep: 7,
      scrollWheelSensitivity: 6,
      momentumIntervalMs: 8,
      printOutlines: false,
      momentumTails: false,
    },
    onTop: true,
    recenter: true,
    resetOnNewSession: true,
    useCustomTickSize: true,
  };
  hotkeys: any = {
    autoCenter: getKeyBindings([KeyCode.KEY_A, KeyCode.KEY_C]),
    autoCenterAllWindows: getKeyBindings([KeyCode.KEY_A, KeyCode.KEY_W]),
    clearAllTotals: getKeyBindings([KeyCode.KEY_C, KeyCode.KEY_T]),
    clearCurrentTradesDown: getKeyBindings([KeyCode.KEY_C, KeyCode.KEY_D]),
    clearCurrentTradesUp: getKeyBindings([KeyCode.KEY_C, KeyCode.KEY_U]),
    clearVolumeProfile: getKeyBindings([KeyCode.KEY_C, KeyCode.KEY_V]),
    clearTotalTradesDown: getKeyBindings([KeyCode.KEY_T, KeyCode.KEY_D]),
    clearTotalTradesUp: getKeyBindings([KeyCode.KEY_T, KeyCode.KEY_U]),
    clearCurrentTradesAllWindows:
      getKeyBindings([ KeyCode.KEY_W, KeyCode.KEY_T]),
    clearCurrentTradesDownAllWindows:
      getKeyBindings([KeyCode.KEY_Q, KeyCode.KEY_D, KeyCode.KEY_W]),
    clearCurrentTradesUpAllWindows:
      getKeyBindings([KeyCode.KEY_Q, KeyCode.KEY_U, KeyCode.KEY_W]),
    clearTotalTradesDownAllWindows:
      getKeyBindings([KeyCode.KEY_D, KeyCode.KEY_W]),
    clearTotalTradesUpAllWindows:
      getKeyBindings([KeyCode.KEY_U, KeyCode.KEY_W]),
  };
  // columns: any = {};
  common: any = {
    fontFamily: 'Open Sans',
    fontSize: 12,
    fontWeight: '',
    generalColors: {
      centerLineColor: 'grey',
      gridLineColor: '#24262C',
      orderGridLineColor: 'rgba(88, 110, 117, 1)',
      simulationModeWarningClr: 'rgba(4, 63, 128, 1)',
    },
    askDelta: true,
    askDepth: true,
    bidDelta: true,
    bidDepth: true,
    currentTradesAtAsk: true,
    currentTradesAtBit: true,
    lqt: true,
    mergeDelta: true,
    notes: true,
    orders: true,
    price: true,
    totalAtAsk: true,
    totalAtBid: true,
    volume: true,
  };
  ltq: any = {
    highlightColor: 'rgba(56, 58, 64, 1)',
    // backgroundColor: 'rgba(1, 43, 54, 1)',
    // buyBackgroundColor: 'rgba(72, 149, 245, 1)',
    color: 'white',
    accumulateTrades: false,
    histogramColor: 'rgba(56, 58, 64, 0.5)',
    // sellBackgroundColor: 'rgba(220, 50, 47, 1)',
    textAlign: TextAlign.Center,
  };
  orderArea = {
    buyButtonsBackgroundColor: '#2A8AD2',
    flatButtonsBackgroundColor: '#383A40',
    buyButtonsFontColor: '#F2F2F2',
    flatButtonFontColor: '#fff',
    sellButtonsBackgroundColor: '#DC322F',
    cancelButtonBackgroundColor: '#51535A',
    sellButtonsFontColor: '#F2F2F2',
    cancelButtonFontColor: '#fff',
    formSettings: {
      showInstrumentChange: true,
      closePositionButton: true,
      showOHLVInfo: true,
      showFlattenButton: true,
      showPLInfo: true,
      showIcebergButton: true,
      roundPL: false,
      includeRealizedPL: false
    },
  };
  price: any = {
    backgroundColor: 'rgba(16, 17, 20, 1)',
    color: 'rgba(208, 208, 210, 1)',
    // highlightBackgroundColor: 'rgba(88, 110, 117, 1)',
    // lastTradedPriceColor: 'rgba(0, 0, 0, 1)',
    // nonTradedPriceBackColor: 'rgba(131, 148, 150, 1)',
    // nonTradedPriceColor: 'rgba(0, 0, 0, 1)',
    textAlign: TextAlign.Center,
    // tradedPriceBackColor: 'rgba(1, 43, 54, 1)',
  };
  bidDelta: any = {
    backgroundColor: 'rgba(72, 149, 245, 0.2)',
    highlightBackgroundColor: 'rgba(72, 149, 245, 1)',
    color: 'white',
    textAlign: TextAlign.Center,
  };
  askDelta: any = {
    backgroundColor: 'rgba(201, 59, 59, 0.3)',
    textAlign: TextAlign.Center,
    highlightBackgroundColor: 'rgba(201, 59, 59, 1)',
    color: '#ffffff',
  };
  bid: any = {
    color: 'white',
    backgroundColor: 'rgba(72, 149, 245, 0.2)',
    highlightBackgroundColor: 'rgba(72, 149, 245, 1)',
    textAlign: TextAlign.Center,
    histogramOrientation: HistogramOrientation.Left,
    largeSize: 14,
    highlightLarge: false,
    histogramColor: 'rgba(72,149,245,0,3)',
    histogramEnabled: true,
    // totalFontColor: 'rgba(255, 255, 0, 1)',
  };
  ask: any = {
    color: 'white',
    backgroundColor: 'rgba(201, 59, 59, 0.3)',
    histogramColor: 'rgba(201, 59, 59, 0.2)',
    highlightBackgroundColor: 'rgba(201, 59, 59, 1)',
    textAlign: TextAlign.Center,
    histogramOrientation: HistogramOrientation.Left,
    largeSize: 14,
    highlightLarge: false,
    histogramEnabled: true,
    // totalFontColor: 'rgba(255, 255, 0, 1)',
  };
  bidDepth: any = {
    backgroundColor: 'rgba(201, 59, 59, 0.3)',
    histogramColor: 'rgba(72, 149, 245, 0.2)',
    highlightBackgroundColor: 'rgba(201, 59, 59, 1)',
    textAlign: TextAlign.Center,
    histogramOrientation: HistogramOrientation.Left,
    color: '#ffffff',
    largeSize: 14,
    highlightLarge: false,
    histogramEnabled: true,
    // totalFontColor: 'rgba(255, 255, 0, 1)',
  };
  askDepth: any = {
    backgroundColor: 'rgba(72, 149, 245, 0.2)',
    histogramColor: 'rgba(201, 59, 59, 0.2)',
    highlightBackgroundColor: 'rgba(72, 149, 245, 1)',
    textAlign: TextAlign.Center,
    histogramOrientation: HistogramOrientation.Left,
    color: '#ffffff',
    largeSize: 14,
    highlightLarge: false,
    histogramEnabled: true,
    // totalFontColor: 'rgba(255, 255, 0, 1)',

  };
  totalAsk: any = {
    histogramColor: 'rgba(72, 149, 245, 0.3)',
    textAlign: TextAlign.Right,
    color: 'rgba(72, 149, 245, 1)',
    backgroundColor: 'transparent',
   // backgroundColor: 'rgba(1, 43, 54, 1)',
    highlightBackgroundColor: 'rgba(56, 58, 64, 1)',
    histogramOrientation: HistogramOrientation.Left,
  };
  totalBid: any = {
    histogramColor: 'rgba(201, 59, 59, 0.3)',
    textAlign: TextAlign.Left,
    color: 'rgba(235, 90, 90, 1)',
    backgroundColor: 'transparent',
    // backgroundColor: 'rgba(1, 43, 54, 1)',
    highlightBackgroundColor: 'rgba(56, 58, 64, 1)',
    histogramOrientation: HistogramOrientation.Right,
  };
  volume: any = {
    highlightBackgroundColor: '#9D0A0A',
    textAlign: TextAlign.Center,
    backgroundColor: 'transparent',
    // backgroundColor: 'rgba(1, 43, 54, 1)',
    // areaColor: 'rgba(109, 112, 196, 1)',
    color: 'white',
    histogramColor: 'rgba(73, 187, 169, 0.5)',
    histogramOrientation: HistogramOrientation.Right,
    VWAP: false,
    controlColor: 'rgba(211, 53, 130, 1)',
    histogramEnabled: false,
    ltq: false,
    poc: false,
    vWAPColor: 'rgba(203, 75, 22, 1)',
    valueArea: false
  };
  order: any = {
    backgroundColor: 'rgba(0, 44, 55, 1)',
    textAlign: TextAlign.Center,
    'break-evenBackground': 'rgba(0, 44, 55, 1)',
    'break-evenForeground': 'rgba(255, 255, 255, 1)',
    buyOrderBackground: 'rgba(22, 140, 213, 1)',
    buyOrderForeground: 'rgba(242, 242, 242, 1)',
    buyOrdersColumn: 'rgba(0, 44, 55, 1)',
    highlightColor: 'rgba(29, 73, 127, 1)',
    inProfitBackground: 'rgba(0, 44, 55, 1)',
    inProfitForeground: 'rgba(72, 149, 245, 1)',
    lossBackground: 'rgba(0, 44, 55, 1)',
    lossForeground: 'rgba(201, 59, 59, 1)',
    sellOrderBackground: 'rgba(201, 59, 59, 1)',
    sellOrderForeground: 'rgba(255, 255, 255, 1)',
    sellOrdersColumn: 'rgba(72, 149, 245, 1)',
    snowPnl: false,
    split: false,
    includePnl: false,
    overlay: false,
  };
  currentBid: any = {
    color: '#EB5A5A',
    histogramColor: 'rgba(201, 59, 59, 0.4)',
    // backgroundColor: 'rgba(1, 43, 54, 1)',
    backgroundColor: 'transparent',
    highlightBackgroundColor: 'rgba(201, 59, 59, 0.4)',
    histogramEnabled: false,
    insideBidBackgroundColor: 'rgba(0, 0, 0, 1)',
    tailInsideAskFore: 'rgba(255, 255, 255, 1)',
    tailInsideBidFore: false,
    tailsBackgroundColors: {
      level1: 'rgba(128, 64, 64, 1)',
      level2: 'rgba(112, 61, 63, 1)',
      level3: 'rgba(96, 59, 62, 1)',
      level4: 'rgba(80, 56, 60, 1)',
      level5: 'rgba(64, 54, 59, 1)',
      level6: 'rgba(48, 51, 58, 1)',
      level7: 'rgba(32, 48, 57, 1)',
      level8: 'rgba(16, 46, 55, 1)',
    },
    textAlign: TextAlign.Center,
  };
  note: any = {
    addedOrdersColor: 'rgba(53, 104, 147, 1)',
    // askVolumeColor: 'rgba(142, 60, 66, 1)',
    backgroundColor: 'transparent',
    // backgroundColor: 'rgba(1, 43, 54, 1)'
    // bidVolumeColor: 'rgba(53, 104, 147, 1)',
    color: 'white',
    // highlightBackgroundColor: 'rgba(88, 110, 117, 1)',
    pulledOrdersColor: 'rgba(143, 60, 65, 1)',
  };
  currentAsk: any = {
    color: '#4895F5',
    histogramColor: 'rgba(4, 63, 128, 1)',
    backgroundColor: 'transparent',
    // backgroundColor: 'rgba(1, 43, 54, 1)'
    histogramEnabled: false,
    insideAskBackgroundColor: 'rgba(0, 0, 0, 1)',
    highlightBackgroundColor: 'rgba(88, 110, 117, 1)',
    tailInsideAskFore: 'rgba(255, 255, 255, 1)',
    tailInsideBidFore: false,
    tailsBackgroundColors: {
      level1: 'rgba(4, 63, 128, 1)',
      level2: 'rgba(3, 60, 119, 1)',
      level3: 'rgba(3, 59, 110, 1)',
      level4: 'rgba(2, 56, 100, 1)',
      level5: 'rgba(2, 54, 91, 1)',
      level6: 'rgba(2, 51, 82, 1)',
      level7: 'rgba(1, 48, 73, 1)',
      level8: 'rgba(1, 46, 63, 1)',
    },
    textAlign: TextAlign.Center,
  };

  static fromJson(json: any): DomSettings {
    const settings = new DomSettings();
    settings.merge(json);
    return settings;
  }

  merge(data: Partial<DomSettings>) {
    for (const key in data) {
      if (!this.hasOwnProperty(key) || key == '_columns' || key == 'columns') {
        console.warn(`Check property ${key} in settings`);
        continue;
      }

      const column = this.columns.find(i => i.name == key);
      // console.log('before', (window as any).grid?.schema[0] == this.columns[0])
      if (column) {
        if (!column.style)
          column.style = {};

        // if (key != '_columns' && key != 'columns')
        Object.assign(column.style, data[key]);
        // console.log((window as any).grid?.scheme[0] == this.columns[0])
      } else {
        console.warn(`Missing column ${key}`);
      }
      Object.assign(this[key], data[key]);
    }

    console.log(data);
  }

  private _setDataToColumns() {
    this.merge(this);
  }

  toJson() {
    return merge({}, this as any);
  }
}
