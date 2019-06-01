import { Directive, ElementRef, HostListener, Injectable, Input } from "@angular/core";
import { CostBenefitAnalysis } from "./economy";
import { CbaTooltipService } from "./cba-tooltip.service";

@Directive({
	selector: "[cba-tooltip]"
})
export class CbaTooltipDirective {

	constructor(private anchor: ElementRef, private tooltipService: CbaTooltipService) {	}

	@Input("cba-tooltip")
	cba: CostBenefitAnalysis;

	@HostListener('mouseenter') 
	show(event: MouseEvent) {
		this.tooltipService.show(this.cba, this.anchor);
	}

	@HostListener('mouseleave')
	hide() {
		this.tooltipService.hide();
	}
}
