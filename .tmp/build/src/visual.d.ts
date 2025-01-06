import powerbi from "powerbi-visuals-api";
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import FormattingModel = powerbi.visuals.FormattingModel;
export declare class Visual implements IVisual {
    private target;
    private settings;
    private formattingSettingsService;
    private isInitialRender;
    private data;
    private svg;
    constructor(options: VisualConstructorOptions);
    /**
 * Updates the state of the visual. Every sequential databinding and resize will call update.
 *
 * @function
 * @param {VisualUpdateOptions} options - Contains references to the size of the container
 *                                        and the dataView which contains all the data
 *                                        the visual had queried.
 */
    update(options: VisualUpdateOptions): void;
    private renderBulgingField;
    private renderButton;
    private renderInputBox;
    private updateCircleChartBasedOnInput;
    getFormattingModel(): FormattingModel;
}
