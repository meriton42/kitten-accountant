import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpModule } from '@angular/http';

import { AppComponent } from './app.component';
import { CostBenefitAnalysisComponent } from './cost-benefit-analysis.component';
import { PanelComponent } from './panel.component';
import { CbaTooltipDirective } from 'app/cba-tooltip.directive';

@NgModule({
  declarations: [
    AppComponent,
    CbaTooltipDirective,
    CostBenefitAnalysisComponent,    
    PanelComponent,
  ],
  imports: [
    BrowserModule,
    FormsModule,
    HttpModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
