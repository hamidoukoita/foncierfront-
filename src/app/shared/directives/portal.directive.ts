import { Directive, ElementRef, OnDestroy, OnInit, inject } from '@angular/core';

/**
 * Rattache l'élément hôte au <body> pour afficher les modales
 * au-dessus de la topbar / sidebar (z-index, overflow).
 */
@Directive({
  selector: '[appPortal]',
  standalone: true,
})
export class PortalDirective implements OnInit, OnDestroy {
  private readonly el = inject(ElementRef<HTMLElement>);

  ngOnInit(): void {
    const node = this.el.nativeElement;
    if (!node.style.zIndex) {
      node.style.zIndex = '2000';
    }
    document.body.appendChild(node);
  }

  ngOnDestroy(): void {
    this.el.nativeElement.remove();
  }
}
