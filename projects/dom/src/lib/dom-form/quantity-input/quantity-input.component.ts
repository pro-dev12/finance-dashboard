import { Component, forwardRef, Input } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { QuantityPositions } from 'dom';

@Component({
  selector: 'quantity-input',
  templateUrl: './quantity-input.component.html',
  styleUrls: ['./quantity-input.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => QuantityInputComponent),
      multi: true,
    }
  ]
})
export class QuantityInputComponent implements ControlValueAccessor {
  @Input() amountButtons = [];
  onChange;
  currentValue: number;

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
  }

  writeValue(obj: any): void {
    this.currentValue = obj;
  }

  updateValue(item: any) {
    this.currentValue = item.value;
    this.onChange(item.value);
  }

  isCurrentValue(item: any) {
    return this.currentValue === item.value;
  }

  selectByPosition(position: QuantityPositions): void {
    const item = this.amountButtons[position];
    this.updateValue(item);
  }
}
