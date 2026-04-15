import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  standalone: true,
  selector: 'app-folder-file-upload',
  template: `
    <div class="container">
      <div class="folder">
        <div class="front-side">
          <div class="tip"></div>
          <div class="cover"></div>
        </div>
        <div class="back-side cover"></div>
      </div>
      <label class="custom-file-upload" [class.is-disabled]="disabled">
        <input
          #fileInput
          class="title"
          type="file"
          [accept]="accept"
          [disabled]="disabled"
          (change)="onFileChange($event)" />
        {{ label }}
      </label>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .container {
        --transition: 350ms;
        --folder-W: 120px;
        --folder-H: 80px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-end;
        padding: 10px;
        background: linear-gradient(135deg, #6dd5ed, #2193b0);
        border-radius: 15px;
        box-shadow: 0 15px 30px rgba(0, 0, 0, 0.2);
        height: calc(var(--folder-H) * 1.7);
        position: relative;
      }

      .folder {
        position: absolute;
        top: -20px;
        left: calc(50% - 60px);
        animation: float 2.5s infinite ease-in-out;
        transition: transform var(--transition) ease;
      }

      .folder:hover {
        transform: scale(1.05);
      }

      .folder .front-side,
      .folder .back-side {
        position: absolute;
        transition: transform var(--transition);
        transform-origin: bottom center;
      }

      .folder .back-side::before,
      .folder .back-side::after {
        content: "";
        display: block;
        background-color: white;
        opacity: 0.5;
        z-index: 0;
        width: var(--folder-W);
        height: var(--folder-H);
        position: absolute;
        transform-origin: bottom center;
        border-radius: 15px;
        transition: transform 350ms;
        z-index: 0;
      }

      .container:hover .back-side::before {
        transform: rotateX(-5deg) skewX(5deg);
      }

      .container:hover .back-side::after {
        transform: rotateX(-15deg) skewX(12deg);
      }

      .folder .front-side {
        z-index: 1;
      }

      .container:hover .front-side {
        transform: rotateX(-40deg) skewX(15deg);
      }

      .folder .tip {
        background: linear-gradient(135deg, #ff9a56, #ff6f56);
        width: 80px;
        height: 20px;
        border-radius: 12px 12px 0 0;
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
        position: absolute;
        top: -10px;
        z-index: 2;
      }

      .folder .cover {
        background: linear-gradient(135deg, #ffe563, #ffc663);
        width: var(--folder-W);
        height: var(--folder-H);
        box-shadow: 0 15px 30px rgba(0, 0, 0, 0.3);
        border-radius: 10px;
      }

      .custom-file-upload {
        font-size: 1.1em;
        color: #ffffff;
        text-align: center;
        background: rgba(255, 255, 255, 0.2);
        border: none;
        border-radius: 10px;
        box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1);
        cursor: pointer;
        transition: background var(--transition) ease;
        display: inline-block;
        width: 100%;
        padding: 10px 35px;
        position: relative;
      }

      .custom-file-upload:hover:not(.is-disabled) {
        background: rgba(255, 255, 255, 0.4);
      }

      .custom-file-upload.is-disabled {
        cursor: not-allowed;
        opacity: 0.65;
      }

      .custom-file-upload input[type="file"] {
        display: none;
      }

      @keyframes float {
        0% {
          transform: translateY(0px);
        }

        50% {
          transform: translateY(-20px);
        }

        100% {
          transform: translateY(0px);
        }
      }
    `
  ],
  imports: [CommonModule]
})
export class FolderFileUploadComponent {
  @Input() label = 'Choose a file';
  @Input() accept = '*/*';
  @Input() disabled = false;

  @Output() fileSelected = new EventEmitter<File>();

  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;

  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.fileSelected.emit(file);
    }
    input.value = '';
  }

  reset() {
    if (this.fileInput?.nativeElement) {
      this.fileInput.nativeElement.value = '';
    }
  }
}
