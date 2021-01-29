import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DataGridModule } from 'data-grid';
import { ComponentStore, LazyModule } from 'lazy-modules';
import { NzDropDownModule, NzRadioModule, NzSelectModule } from 'ng-zorro-antd';
import { PositionsComponent } from './positions.component';
import { AccountSelectModule } from 'account-select';
import { LayoutModule } from 'layout';
import { WindowHeaderModule } from 'window-header';

@NgModule({
  imports: [
    CommonModule,
    DataGridModule,
    NzSelectModule,
    ReactiveFormsModule,
    AccountSelectModule,
    LayoutModule,
    WindowHeaderModule,
    NzDropDownModule,
    NzRadioModule,
    FormsModule,
  ],
  exports: [
    PositionsComponent
  ],
  declarations: [
    PositionsComponent,
  ],

})
export class PositionsModule implements LazyModule {
  get components(): ComponentStore {
    return {
      positions: PositionsComponent
    };
  }
}
