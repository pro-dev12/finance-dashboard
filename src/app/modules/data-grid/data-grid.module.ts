import { DataGrid } from './components/data-grid/data-grid.component';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ItemViewBuilder } from './components/item-view-builder';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { IconComponent } from './models/cells/components/icon-conponent';
import { CapitalizePipe } from './components/capitalize';

const entryComponents = [
  DataGrid,
  IconComponent,
];

@NgModule({
  imports: [
    CommonModule,
    ScrollingModule,
  ],
  declarations: [
    ItemViewBuilder,
    CapitalizePipe,

    ...entryComponents,
  ],
  entryComponents,
  exports: entryComponents,
})
export class DataGridModule {
}
