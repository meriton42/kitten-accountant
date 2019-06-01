import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';
import { CostBenefitAnalysisComponent } from './cost-benefit-analysis.component';
import { PanelComponent } from './panel.component';
import { CbaTooltipDirective } from 'app/cba-tooltip.directive';
import { HelpDirective } from './help.directive';

@NgModule({
  declarations: [
    AppComponent,
    CbaTooltipDirective,
    CostBenefitAnalysisComponent,    
    HelpDirective,
    PanelComponent,
  ],
  imports: [
    BrowserModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
