import { ScrollingModule } from '@angular/cdk/scrolling';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DataGridModule } from 'data-grid';
import { DynamicFormModule } from 'dynamic-form';
import { InstrumentSelectModule } from 'instrument-select';
import { ComponentStore, LazyModule } from 'lazy-modules';
import { NzMenuModule } from 'ng-zorro-antd';
import { StorageModule } from 'storage';
import { WindowHeaderModule } from 'window-header';
import { DomSettingsSelector, DomSettingsComponent } from './dom-settings/dom-settings.component';
import { DomComponent } from './dom.component';
import { HistogramComponent } from './histogram';

@NgModule({
  declarations: [
    DomComponent,
    DomSettingsComponent,
    HistogramComponent,
  ],
  imports: [
    DataGridModule,
    InstrumentSelectModule,
    WindowHeaderModule,
    NzMenuModule,
    DynamicFormModule,
    ScrollingModule,
    StorageModule,
    CommonModule,
  ],
  exports: [
    DomComponent,
  ]
})
export class DomModule implements LazyModule {
  get components(): ComponentStore {
    return {
      dom: DomComponent,
      [DomSettingsSelector]: DomSettingsComponent,
    };
  }
}
