import { Component } from '@angular/core';

@Component({
    standalone: true,
    selector: 'app-footer',
    template: `<div class="layout-footer">
  <img
    src="assets/images/Logo taskflow.png"
    alt="TaskFlow"
    class="layout-footer-logo" />
  by
  <a href="https://www.siga.tn/" target="_blank" rel="noopener noreferrer" class="text-primary font-bold hover:underline">SIGA</a>
</div>`,
})
export class AppFooter {}
