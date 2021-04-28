import { Id } from 'base-components';
import {
  AddClassStrategy,
  Cell,
  DataCell,
  IconCell,
  IFormatter,
  NumberCell,
  ProfitClass,
  RoundFormatter
} from 'data-grid';
import { IPosition, Side, TradePrint } from 'trading';

export class PositionItem {
  private _priceFormatter: IFormatter;

  get id(): Id | undefined {
    return this.position && this.position.id;
  }

  account = new DataCell();
  instrumentName = new DataCell();
  exchange = new DataCell();
  price = new NumberCell();
  size = new NumberCell();
  unrealized = new NumberCell({strategy: AddClassStrategy.RELATIVE_ZERO, hightlightOnChange: false});
  realized = new NumberCell({strategy: AddClassStrategy.RELATIVE_ZERO, hightlightOnChange: false});
  total = new NumberCell();
  close = new IconCell();
  side = new DataCell();
  position: IPosition;


  constructor(position?: IPosition) {
    if (!position) {
      return;
    }
    this._priceFormatter = new RoundFormatter(position.instrument?.precision ?? 2);
    this.price.formatter = this._priceFormatter;
    this.unrealized.formatter = this._priceFormatter;
    this.realized.formatter = this._priceFormatter;
    this.total.formatter = this._priceFormatter;
    this.update(position);
  }

  update(position: IPosition) {
    this.position = { ...this.position, ...position };
    this.account.updateValue(position.accountId);
    this.instrumentName.updateValue(this.position.instrument.symbol);
    this.exchange.updateValue(this.position.instrument.exchange);
    const fields = ['price', 'size', 'instrumentName', 'unrealized', 'realized', 'total', 'side'];
    for (let key of fields) {
      this[key].updateValue(position[key]);
    }

    const iconClass = position.side !== Side.Closed ? 'icon-close-window' : 'd-none';
    this.close.updateClass(iconClass);
    this._updateCellProfitStatus(this.unrealized);
    this._updateCellProfitStatus(this.realized);
  }

  public updateUnrealized(trade: TradePrint) {
    if (this.position == null || trade.instrument.symbol != this.position.instrument.symbol)
      return;
    const currentPrice = +this.price.value;
    const { volume, price } = trade;
    switch (this.side.value) {
      case Side.Long:
        this.unrealized.updateValue(this._calculateLongUnrealized(currentPrice, volume, price));
        break;

      case Side.Short:
        this.unrealized.updateValue(this._calculateShortUnrealized(currentPrice, volume, price));
        break;
    }

    this._updateCellProfitStatus(this.unrealized);
  }

  private _calculateLongUnrealized(currentPrice: number, volume: number, price: number): number {
    return ((currentPrice * volume) - (price * volume));
  }

  private _calculateShortUnrealized(currentPrice: number, volume: number, price: number): number {
    return ((price * volume) - (currentPrice * volume));
  }

  private _updateCellProfitStatus(cell: Cell): void {
    let status = '';

    if (cell.class === ProfitClass.DOWN)
      status = 'loss';
    else if (cell.class === ProfitClass.UP)
      status = 'inProfit';
    cell.changeStatus(status);
  }
}


