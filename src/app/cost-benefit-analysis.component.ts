import { Component, OnInit, Input } from '@angular/core';
import { CostBenefitAnalysis } from "./economy";

@Component({
  selector: 'cost-benefit-analysis',
  templateUrl: './cost-benefit-analysis.component.html',
})
export class CostBenefitAnalysisComponent implements OnInit {
  @Input()
  cba: CostBenefitAnalysis;

  ngOnInit() {

  }
}
