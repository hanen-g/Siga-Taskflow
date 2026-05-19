import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CLIENT_LABEL_COLOR_PALETTE, DEFAULT_CLIENT_LABEL_COLOR, resolvedClientLabelColor } from './client-label-colors';

@Component({
  selector: 'app-client-label-color-picker',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './client-label-color-picker.html',
  styleUrl: './client-label-color-picker.css',
})
export class ClientLabelColorPickerComponent {
  /** Shown above the swatches (matches other form labels). */
  @Input() heading = 'Color Code';
  @Input() disabled = false;
  @Input() selectedColor = DEFAULT_CLIENT_LABEL_COLOR;
  @Output() selectedColorChange = new EventEmitter<string>();

  readonly palette = [...CLIENT_LABEL_COLOR_PALETTE];

  pick(hex: string): void {
    if (this.disabled) return;
    this.selectedColorChange.emit(hex);
  }

  isSelected(hex: string): boolean {
    return resolvedClientLabelColor(this.selectedColor) === hex.toLowerCase();
  }
}