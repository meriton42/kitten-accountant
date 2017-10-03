import { Component, OnInit, Input } from '@angular/core';

@Component({
  selector: 'panel',
	template: `
		<div style="float: left; margin-right: 3em; margin-bottom: 1em">
			<h2 style="text-align: center">{{heading}}</h2>
			<ng-content></ng-content>
		</div>
	`
})
export class PanelComponent {

	@Input() heading: string;

}