import { Cell } from 'data-grid';
import { IInstrument } from './instrument';

export class InstrumentNameCell extends Cell {
  value = '';

  constructor(instrument: IInstrument) {
    super();
    this.value = instrument.name;
  }

  updateValue(instrument: IInstrument) {
    this.value = instrument.name;
  }
}
