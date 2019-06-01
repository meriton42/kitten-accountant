import { Injectable, ElementRef } from "@angular/core";
import { CostBenefitAnalysis } from "./economy";

@Injectable() 
export class CbaTooltipService {
	cba: CostBenefitAnalysis;
	left: number;
	top: number;

	show(cba: CostBenefitAnalysis, anchor: ElementRef) {
		const p = anchor.nativeElement.getBoundingClientRect();
		this.cba = cba;
		this.left = p.right;
		this.top = p.top;
	}

	hide() {
		this.cba = null;
	}
}