import { Component, OnInit } from '@angular/core';
import { FieldType } from '@ngx-formly/core';

@Component({
  selector: 'number-input',
  templateUrl: './number-input.component.html',
  styleUrls: ['./number-input.component.scss']
})
export class NumberInputComponent extends FieldType {
  get value() {
    return this.formControl.value;
  }

  set value(value) {
    if (this.field.templateOptions?.min == null || value >= this.field.templateOptions.min)
      this.formControl.patchValue(value);
    else {
      this.formControl.patchValue(this.field.templateOptions?.min);
    }
  }
}
