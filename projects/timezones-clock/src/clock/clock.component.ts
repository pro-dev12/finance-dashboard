import { Component, Input, OnInit } from '@angular/core';
import { NzModalService, NzPlacementType } from "ng-zorro-antd";
import { AddTimezoneModalComponent } from "../add-timezone-modal/add-timezone-modal.component";
import { TimezonesService } from "../timezones.service";
import { ITimezone, Timezone, TIMEZONES } from "../timezones";
import { interval } from "rxjs";
import { UntilDestroy, untilDestroyed } from "@ngneat/until-destroy";

@UntilDestroy()
@Component({
  selector: 'app-clock',
  templateUrl: './clock.component.html',
  styleUrls: ['./clock.component.scss']
})
export class ClockComponent implements OnInit {
  time: number;
  timezones: ITimezone[] = [];
  localTimezone: ITimezone;
  enabledTimezone: ITimezone;

  @Input() dropdownPlacement: NzPlacementType;

  constructor(private modalService: NzModalService,
              private timezonesService: TimezonesService) {

    interval(1000)
      .pipe(untilDestroyed(this))
      .subscribe(() => this.time = Date.now())
  }

  ngOnInit(): void {
    this.localTimezone = this._getLocalTimezone();

    this.timezonesService.timezonesData$.subscribe((data) => {
      this.timezones = data.timezones
      this.enabledTimezone = this.timezonesService.enabledTimezone;
      this.localTimezone.name = data.localTimezoneTitle;
    })
  }

  addTimezone(): void {
    this.modalService.create({
      nzContent: AddTimezoneModalComponent,
      nzWrapClassName: 'timezones-modal vertical-center-modal',
      nzFooter: null,
      nzWidth: 416
    });
  }

  deleteTimezone(timezone: ITimezone): void {
    this.timezonesService.delete(timezone);
  }

  updateTimezoneName(timezone: ITimezone, name: string): void {
    this.timezonesService.rename(timezone, name);
  }

  toggleTimezone(timezone: ITimezone, enabled: boolean): void {
    this.timezonesService.toggleEnabled(timezone, enabled);
  }

  resetTimezone(timezone: ITimezone): void {
    this.timezonesService.resetItem(timezone);
  }

  renameLocalTitle(title: string): void {
    this.timezonesService.changeLocalTitle(title);
  }

  resetLocalTitle(): void {
    this.timezonesService.resetLocalTitle();
  }

  private _getLocalTimezone(): ITimezone {
    const timezoneName = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const foundTimezones = TIMEZONES.filter(timezone => {
      return timezone.utc.some(i => i === timezoneName);
    })

    const supposedTimezone = (foundTimezones || []).reduce((acc, item) => {
      return item.utc.length < acc?.utc.length ? item : acc;
    });

    return supposedTimezone ? new Timezone(supposedTimezone) : null;
  }
}
