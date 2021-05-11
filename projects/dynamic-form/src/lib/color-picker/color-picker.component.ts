import {Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {FieldType} from '@ngx-formly/core';
import {SettingsService} from 'settings';
import {UntilDestroy, untilDestroyed} from '@ngneat/until-destroy';

enum ColorType {
  HEX = 'HEX',
  RGB = 'RGB'
}

type RGBA = {
  r: number;
  g: number;
  b: number;
  a?: number;
};

const Palette: string[][] = [
  ['#FFE8E8', '#F68E8E', '#F16E6E', '#E95050', '#EA3939', '#DD2121', '#CB1212', '#BC0606', '#9D0A0A', '#820303'],
  ['#FFE0CF', '#FFBB96', '#FFA16D', '#FF8440', '#FF6C1C', '#FF5A00', '#E04F00', '#C04400', '#9C3700', '#802D00'],
  ['#FFFAEA', '#FFF6D7', '#FFEEB4', '#FFE68E', '#FFDF6F', '#FFD43E', '#FFC700', '#D3A500', '#AD8700', '#8B6D00'],
  ['#BCFFDF', '#75FFBD', '#00FF85', '#00F27E', '#00DC72', '#00BD62', '#009950', '#007A40', '#006534', '#004A27'],
  ['#CAFFFD', '#B0F0EE', '#70EAE6', '#3AEAE4', '#1CE4DD', '#00E5DD', '#00CFC8', '#00B2AC', '#009691', '#007A76'],
  ['#F0F9FF', '#CEEAFF', '#9FD7FF', '#78C6FF', '#59B9FF', '#29A5FF', '#0094FF', '#0083E2', '#006FBF', '#005B9C'],
  ['#BBD6FF', '#8DBBFF', '#4895F5', '#2669ED', '#1E4EF6', '#0E43FF', '#0033E9', '#0029BC', '#00239E', '#00208F'],
  ['#E4CFFF', '#C597FF', '#8F37FF', '#7A11FF', '#6900EF', '#6000DA', '#5600C5', '#4B00AB', '#400090', '#3E008B'],
  ['#FFDCFB', '#FF8AF3', '#FF42EC', '#FE00E5', '#DE00C8', '#BE00AB', '#9D008E', '#7C0070', '#600056', '#5A0051'],
  ['#FFFFFF', '#E5E5E5', '#CCCCCC', '#B8B8B8', '#999999', '#7F7F7F', '#666666', '#4C4C4C', '#3F3F3F', '#000000'],
];

@UntilDestroy()
@Component({
  selector: 'color-picker',
  templateUrl: './color-picker.component.html',
  styleUrls: ['./color-picker.component.scss']
})
export class ColorPickerComponent extends FieldType implements OnInit {
  @ViewChild('colorInput') colorInput: ElementRef<HTMLInputElement>;

  readonly palette: string[][] = Palette;
  readonly colorType = ColorType;

  lastPickedColors: { withOpacity: boolean, colorWithoutOpacity: string, color: string }[] = [];
  selectedColorType: ColorType;
  opacity = 100;
  inputValue: string;

  constructor(private settingsService: SettingsService) {
    super();
  }

  ngOnInit() {
    this.selectedColorType = isHex(this.formControl.value) ? ColorType.HEX : ColorType.RGB;
    this._setInputValue();
    this.settingsService.settings
      .pipe(untilDestroyed(this))
      .subscribe((settings) => {
        this.lastPickedColors = settings.lastPickedColors.map(color => {
          if (isHex(color)) {
            return  {withOpacity: false, color: color, colorWithoutOpacity: color}
          }

          const rgb = parseRgbString(color);
          const withOpacity = rgb.a !== 1;
          let withoutOpacity = color;
          if (withOpacity) {
            withoutOpacity = rgbToString({...rgb, a: 1});
          }

          return {withOpacity, color, colorWithoutOpacity: withoutOpacity};
        });
      });
  }

  updateValue(color: string, updateHistory = true): void {
    const startColor = this.formControl.value;

    if (this.formControl.disabled)
      return;

    if (this.selectedColorType === ColorType.HEX) {
      if (isHex(color)) {
        this.formControl.patchValue(color);
      } else {
        const rgb = parseRgbString(color);
        this.formControl.patchValue(rgbToHex(rgb));
      }
      this.opacity = 100;
    } else {
      if (!isHex(color)) {
        this.formControl.patchValue(color);
        this.opacity = parseRgbString(color).a * 100;
      } else {
        const rgb = hexToRgb(color);
        this.formControl.patchValue(rgbToString(rgb));
        this.opacity = 100;
      }
    }

    if (color !== startColor && updateHistory) {
      this._updatePickedColors(color);
    }
    this._setInputValue();
  }

  handleColorTypeChange(type: ColorType): void {
    this.selectedColorType = type;
    this.updateValue(this.formControl.value);
  }

  updateOpacity(): void {
    if (this.selectedColorType === ColorType.RGB) {
      const rgb = parseRgbString(this.formControl.value);
      rgb.a = this.opacity / 100;
      const color = rgbToString(rgb);
      this.formControl.patchValue(color);
      this._setInputValue();
      this._updatePickedColors(color);
    }
  }

  private _updatePickedColors(color: string): void {
    if (this.lastPickedColors.length < 10) {
      this.settingsService.updateLastPickedColors([...this.lastPickedColors.map(i => i.color), color]);
    } else {
      this.settingsService.updateLastPickedColors([...this.lastPickedColors.slice(1).map(i => i.color), color]);
    }
  }

  private _setInputValue(): void {
    if (this.selectedColorType === ColorType.HEX) {
      this.inputValue = this.formControl.value.replace('#', '');
    } else {
      const rgb = parseRgbString(this.formControl.value);
      this.inputValue = `${rgb.r},${rgb.g},${rgb.b}`;
    }

    if (this.colorInput) {
      this.colorInput.nativeElement.value = this.inputValue;
    }
  }

  handleInputValueChange(color: string): void {
    if (this.selectedColorType === ColorType.HEX) {
      if (isHex('#' + color)) {
        this.updateValue('#' + color);
      } else {
        this._setInputValue();
      }
    } else {
      const rgbColors = color.split(',');
      if (rgbColors.length === 3 && rgbColors.every(c => +c <= 255 && +c >= 0)) {
        this.updateValue( `rgb(${color},${this.opacity / 100})`);
      } else {
        this._setInputValue();
      }
    }
  }
}

function hexToRgb(hex: string): { r: number, g: number, b: number, a: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
    a: 1
  } : null;
}

function rgbToHex(rgb: RGBA): string {
  return '#' + ((1 << 24) + (rgb.r << 16) + (rgb.g << 8) + rgb.b).toString(16).slice(1);
}

function rgbToString(rgb: RGBA): string {
  return `rgb(${rgb.r},${rgb.g},${rgb.b},${rgb.a ?? 1})`;
}

function parseRgbString(color: string): RGBA {
  const startDeleteIndex = color.startsWith('rgba') ? 5 : 4;
  const arr = color.substring(startDeleteIndex, color.length - 1)
    .replace(/ /g, '')
    .split(',');

  return {r: +arr[0], g: +arr[1], b: +arr[2], a: +arr[3] ?? 1};
}

function isHex(color: string): boolean {
  return /^#([0-9A-F]{3}){1,2}$/i.test(color);
}

function isRGB(color: string): boolean {
  return color.startsWith('rgb');
}
