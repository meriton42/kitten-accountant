import { Directive, TemplateRef, Input, HostListener } from "@angular/core";
import { HelpService } from "./help.service";

@Directive({
	selector: '[help]',
})
export class HelpDirective {

	@Input()
	help: TemplateRef<void>;

	prevTopic: TemplateRef<void>;

	constructor(private helpService: HelpService) {}

	@HostListener("mouseenter")
	enter() {
		this.prevTopic = this.helpService.topic;
		this.helpService.topic = this.help;
	}

	@HostListener("mouseleave")
	leave() {
		this.helpService.topic = this.prevTopic;
	}

}