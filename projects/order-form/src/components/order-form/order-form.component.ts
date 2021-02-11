import { Component, Injector, Input, OnInit, ViewChild } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { AccountsManager } from 'accounts-manager';
import { BaseOrderForm, QuantityInputComponent } from 'base-order-form';
import { Id } from 'communication';
import { ILayoutNode, LayoutNode } from 'layout';
import {
  IInfo,
  IInstrument,
  IOrder, IQuote, Level1DataFeed,
  OrderDuration,
  OrderSide,
  OrdersRepository,
  OrderType,
  PositionsRepository
} from 'trading';

export interface OrderFormComponent extends ILayoutNode {
}

@Component({
  selector: 'order-form',
  templateUrl: './order-form.component.html',
  styleUrls: ['./order-form.component.scss']
})
@UntilDestroy()
@LayoutNode()
export class OrderFormComponent extends BaseOrderForm implements OnInit {
  OrderDurations = Object.values(OrderDuration);
  OrderTypes = Object.values(OrderType);
  step = 1;
  OrderSide = OrderSide;
  editIceAmount: boolean;

  bidInfo: IInfo;
  askInfo: IInfo;

  limitPrice: number;


  price: number;

  get isStopLimit() {
    return OrderType.StopLimit === this.formValue.type;
  }

  @ViewChild(QuantityInputComponent) quantityInput: QuantityInputComponent;

  private _instrument: IInstrument;

  get shouldDisablePrice() {
    const limitTypes = [OrderType.Limit, OrderType.StopLimit, OrderType.StopMarket];
    return !limitTypes.includes(this.formValue.type);
  }

  get quantity() {
    return this.formValue.quantity;
  }

  @Input()
  set instrument(value: IInstrument) {
    if (value?.id === this.instrument?.id)
      return;

    this._levelOneDatafeedService.unsubscribe(this._instrument);
    this._levelOneDatafeedService.subscribe(value);
    this._instrument = value;
    const { symbol, exchange } = value;
    this.form.patchValue({ symbol, exchange });

    this.bidInfo = null;
    this.askInfo = null;
  }

  get instrument(): IInstrument {
    return this._instrument;
  }

  get accountId() {
    return this.formValue.accountId;
  }

  amountButtons = [
    { value: 1 }, { value: 2 },
    { value: 10 }, { value: 50 },
    { value: 100 },
  ];

  constructor(
    protected fb: FormBuilder,
    protected _repository: OrdersRepository,
    protected positionsRepository: PositionsRepository,
    protected _levelOneDatafeedService: Level1DataFeed,
    protected _accountsManager: AccountsManager,
    protected _injector: Injector
  ) {
    super();
    this.autoLoadData = false;

    this.setTabIcon('icon-widget-create-orders');
  }

  getDto(): any {
    const dto = super.getDto();
    if (dto.type === OrderType.Limit) {
      dto.limitPrice = this.price;
    }
    if ([OrderType.StopLimit, OrderType.StopMarket].includes(dto.type)) {
      dto.stopPrice = this.price;
    }
    if (this.isStopLimit)
      dto.limitPrice = this.limitPrice;
    return dto;
  }

  ngOnInit() {
    super.ngOnInit();

    this._accountsManager.connections
      .pipe(untilDestroyed(this))
      .subscribe(() => {
        const connection = this._accountsManager.getActiveConnection();
        this._repository = this._repository.forConnection(connection);
        this.positionsRepository = this.positionsRepository.forConnection(connection);
      });

    this.onRemove(this._levelOneDatafeedService.on((trade: IQuote) => {
      if (trade.instrument?.symbol === this.instrument?.symbol) {
        // this.askInfo = trade.askInfo;
        // this.bidInfo = trade.bidInfo;
      }
    }));
  }

  closePositions() {
    this.positionsRepository.deleteMany({
      accountId: this.accountId,
      ...this._instrument,
    }).subscribe(
      () => this.notifier.showSuccess(null),
      (error) => this.notifier.showError(error),
    );
  }

  createForm() {
    return this.fb.group({
      accountId: [null],
      type: [OrderType.Market],
      quantity: [1],
      exchange: null,
      stopLoss: {
        stopLoss: false,
        ticks: 10,
        unit: 'ticks'
      },
      iceAmount: [10],
      isIce: [false],
      takeProfit: {
        takeProfit: false,
        ticks: 10,
        unit: 'ticks'
      },
      symbol: null,
      duration: [OrderDuration.GTC],
      side: [null],
      limitPrice: [null],
      stopPrice: [null],
    });
  }

  submit(side: OrderSide) {
    this.form.patchValue({ side });

    this.apply();
  }

  handleAccountChange(accountId: Id): void {
    this.form.patchValue({ accountId });
    this.loadPositions();
  }


  protected handleItem(item: IOrder): void {
    super.handleItem(item);

    this.needCreate = true;
  }

  updateQuantity(quantity: any) {
    this.form.patchValue({ quantity });
  }

  incrementQuantity() {
    const quantity = this.quantity + 1;
    this.form.patchValue({ quantity });
  }

  decrementQuantity() {
    const quantity = this.quantity - 1;
    if (quantity >= 1)
      this.form.patchValue({ quantity });
  }

  addToSelectedQuantity(count: number) {
    const currentButton = this.quantityInput.currentItem;
    currentButton.value = count + currentButton.value;
  }

  increasePrice() {
    if (this.shouldDisablePrice)
      return;
    const newPrice = this.price || 0;
    this.price = newPrice + (this.instrument?.tickSize || 0.1);
  }

  decreasePrice() {
    if (this.shouldDisablePrice)
      return;
    const newPrice = (this.price || 0) - (this.instrument?.tickSize || 0.1);
    if (newPrice >= 0)
      this.price = newPrice;
  }
}
