import { Component, EventEmitter, Input, Output } from '@angular/core';
import { IChart, ITimeFrame, StockChartXPeriodicity, TimeFrame } from '../../models';
import { NotifierService } from 'notifier';

@Component({
  selector: 'frame-selector',
  templateUrl: './frame-selector.component.html',
  styleUrls: ['./frame-selector.component.scss']
})
export class FrameSelectorComponent {
  timeInterval = 1;
  timePeriodicity = StockChartXPeriodicity.HOUR;

  peridInterval = 3;
  periodPeriodicity = StockChartXPeriodicity.WEEK;

  isLeaving = false;


  @Input() chart: IChart;

  @Output() periodAdded = new EventEmitter();
  @Output() intervalAdded = new EventEmitter();


  get timeFrame() {
    return this.chart?.timeFrame;
  }

  set timeFrame(value) {
    const chart = this.chart;
    if (!chart)
      return;
    chart.timeFrame = value;
    this.updateChartBars();
  }

  private _timePeriod: ITimeFrame = { periodicity: StockChartXPeriodicity.WEEK, interval: 3 };

  get timePeriod() {
    return this._timePeriod;
  }

  set timePeriod(value) {
    this._timePeriod = value;
    this.updateChartBars();
  }

  customPeriodOptions = [StockChartXPeriodicity.DAY,
    StockChartXPeriodicity.WEEK, StockChartXPeriodicity.MONTH,
    StockChartXPeriodicity.YEAR];

  customIntervalOptions = [
    StockChartXPeriodicity.SECOND,
    StockChartXPeriodicity.MINUTE,
    StockChartXPeriodicity.HOUR,
    ...this.customPeriodOptions,
    StockChartXPeriodicity.TICK,
    StockChartXPeriodicity.VOLUME,
    StockChartXPeriodicity.REVS,
    StockChartXPeriodicity.RENKO,
    StockChartXPeriodicity.RANGE,
  ];

  @Input() intervalOptions = [];
  @Input() periodOptions: any = [];

  constructor(private _notifier: NotifierService) {
  }

  getTimeFrame(timeFrame: ITimeFrame): string {
    const label = this.getTimeFrameLabel(timeFrame.periodicity);
    return `${timeFrame.interval} ${label}`;
  }

  getTimeFrameLabel(periodicity) {
    return TimeFrame.periodicityToString(periodicity);
  }

  deletePeriod(frame: TimeFrame, option: any) {
    option.timeFrames = option.timeFrames.filter(item => item !== frame);
  }

  deleteInterval(frame: any, option: any) {
    option.timeFrames = option.timeFrames.filter(item => item !== frame);
  }

  addPeriod() {
    const interval = this.peridInterval;
    const periodicity = this.periodPeriodicity;
    const frame = { interval, periodicity };
    this.periodAdded.emit(frame);
  }

  addFrameInterval() {
    const interval = this.timeInterval;
    const periodicity = this.timePeriodicity;
    const frame = { interval, periodicity };
    this.intervalAdded.emit(frame);
  }

  selectTimePeriod(frame) {
    this.timePeriod = frame;
  }

  updateChartBars() {
    const periodTime = TimeFrame.timeFrameToTimeInterval(this.timePeriod);
    const intervalTime = TimeFrame.timeFrameToTimeInterval(this.timeFrame);
    const endDate = new Date();
    const startDate = new Date(Date.now() - periodTime);
    this.chart.setDates(startDate, endDate);
    this.chart.sendBarsRequest();

    this.periodOptions = this.periodOptions.map(item => {
      item.timeFrames = item.timeFrames.map(frame => {
        frame.disabled = intervalTime > TimeFrame.timeFrameToTimeInterval(frame);
        return frame;
      });
      return item;
    });
  }

  isIntervalSelected(frame: ITimeFrame) {
    return compareTimeFrames(this.timeFrame, frame);
  }

  isPeriodSelected(frame: ITimeFrame) {
    return compareTimeFrames(this.timePeriod, frame);
  }
}

export function compareTimeFrames(obj1: ITimeFrame, obj2: ITimeFrame) {
  if (!obj1 || !obj2)
    return;

  return obj2.interval === obj1.interval
    && obj2.periodicity === obj1.periodicity;
}
