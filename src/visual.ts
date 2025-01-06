import { formattingSettings, FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import powerbi from "powerbi-visuals-api";


import * as d3 from "d3"
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import { VisualFormattingSettingsModel } from "./settings";
import FormattingModel = powerbi.visuals.FormattingModel
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
export class Visual implements IVisual {
    private target: HTMLElement;
    private settings: VisualFormattingSettingsModel;
    private formattingSettingsService: FormattingSettingsService;
    private isInitialRender: boolean = false;
    private data;
    private svg;
    constructor(options: VisualConstructorOptions) {
        this.target = options.element;
        this.formattingSettingsService = new FormattingSettingsService();
        this.settings = new VisualFormattingSettingsModel();
    }

    /**
 * Updates the state of the visual. Every sequential databinding and resize will call update.
 *
 * @function
 * @param {VisualUpdateOptions} options - Contains references to the size of the container
 *                                        and the dataView which contains all the data
 *                                        the visual had queried.
 */

    public update(options: VisualUpdateOptions): void {
        this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
            VisualFormattingSettingsModel, options.dataViews);

        console.log(options.dataViews[0])

        if (!options.dataViews || !options.dataViews[0]) {
            return;
        }
        const dataView = options.dataViews[0];
        const categorical = dataView.categorical;

        if (!categorical || !categorical.categories || !categorical.values) {
            return;
        }
        const categories = categorical.categories[0].values;
        const values = categorical.values[0].values;
        var data = []
        for (let index = 0; index < values.length; index++) {
            const element = String(values[index]).split(' ').map(Number);
            for (let j = 360; j > 0; j--) {
                let fake_obj = {
                    degree: j,
                    elevation: index,
                    displacement: element[-(j - 360)],
                }
                data.push(fake_obj)
            }
        }
        data = data.sort((a, b) => b.elevation - a.elevation);
        console.log(data)
        this.data = data


        this.renderBulgingField(data, options.viewport)
    }

    private renderBulgingField(data: Array<{ degree: number; elevation: number; displacement: number }>, viewport): void {
        var width = viewport.width;
        var height = viewport.height;

        var width_field = width / 1.8;
        var height_field = height / 1.2;
        var margin = { top: 80, right: 50, bottom: 80, left: 50 };

        d3.select(this.target).selectAll("*").remove();
        // this.renderButton();
        var svg = d3
            .select(this.target)
            .append("svg")
            .attr("width", (width + margin.left + margin.right))
            .attr("height", (height + margin.top + margin.bottom))
            .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
        this.svg = svg
        const container = d3.select("#chart-container");
        // Add canvas
        var canvas = d3
            .select(this.target)
            .append("canvas")
            .attr("width", width_field - margin.left - margin.right)
            .attr("height", height_field - margin.top - margin.bottom)
            .style("position", "absolute")
            .style("left", margin.left + "px")
            .style("top", margin.top + "px")
            .style("cursor","crosshair")
            .node() as HTMLCanvasElement;

        var context = canvas.getContext("2d");
        if (!context) return;

        var xScale = d3
            .scaleLinear()
            .domain([0, 360])
            .range([0, width_field - margin.left - margin.right]);

        var yScale = d3
            .scaleLinear()
            .domain([
                d3.min(data, d => d.elevation) - 10,
                d3.max(data, d => d.elevation),
            ])
            .range([height_field - margin.top - margin.bottom, 0]);

        var field_list = [
            d3.min(data, d => d.displacement),
            d3.quantile(data.map(d => d.displacement).sort(d3.ascending), 0.33),
            d3.quantile(data.map(d => d.displacement).sort(d3.ascending), 0.67),
            d3.max(data, d => d.displacement),
        ];

        var colorScale = d3
            .scaleLinear<string>()
            .domain(field_list)
            .range(["blue", "cyan", "yellow", "red"]);

        // Clear canvas
        context.clearRect(0, 0, canvas.width, canvas.height);

        // Draw points
        data.forEach(d => {
            context.beginPath();
            context.arc(xScale(d.degree), yScale(d.elevation), 2, 0, 2 * Math.PI);
            context.fillStyle = colorScale(d.displacement);
            context.fill();
        });

        svg
            .append("g")
            .attr("transform", `translate(0, ${height_field - margin.top - margin.bottom})`)
            .attr("class", "axis")
            .attr("stroke-width", "1.5px")
            .style("font-size", "16px")
            .style("font-weight", "bold")
            .call(
                d3.axisBottom(xScale)
                    .tickValues(d3.range(0, 361, 30)) // Các giá trị trên trục
                    .tickFormat((d) => {
                        const directions: { [key: number]: string } = { 0: "W", 90: "N", 180: "E", 270: "S", 360: "W" };
                        return directions[d as number] || d.toString();
                    })

            );

        // Y axis
        svg
            .append("g")
            .attr("transform", `translate(-2, ${0})`)
            .attr("class", "axis")
            .attr("stroke-width", "1.5px")
            .style("font-size", "16px")
            .style("font-weight", "bold")
            .call(d3.axisLeft(yScale));

        // Color Legend
        var legendWidth = width_field / 2;
        var legendHeight = height_field / 26;

        var legend = svg
            .append("g")
            .attr("transform", `translate(${width_field / 6}, ${-margin.top / 1.5})`);

        var legendScale = d3
            .scaleLinear()
            .domain([
                d3.min(data, d => d.displacement),
                d3.max(data, d => d.displacement),
            ])
            .range([0, legendWidth]);

        var legendAxis = d3.axisBottom(legendScale).ticks(5);
        var each_width = legendWidth / 256;

        legend
            .append("g")
            .selectAll("rect")
            .data(d3.range(
                d3.min(data, d => d.displacement),
                d3.max(data, d => d.displacement),
                (d3.max(data, d => d.displacement) - d3.min(data, d => d.displacement)) / 256
            ))
            .enter()
            .append("rect")
            .attr("x", d => legendScale(d))
            .attr("y", 0)
            .attr("width", each_width)
            .attr("height", legendHeight)
            .attr("fill", d => colorScale(d));

        legend
            .append("g")
            .attr("transform", `translate(0, ${legendHeight})`)
            .attr("class", "axis")
            .style("font-size", "16px")
            .style("font-weight", "bold")
            .call(legendAxis);

        // Title
        svg
            .append("text")
            .attr("x", width_field / 2.5)
            .attr("y", -margin.top / 2 - 20)
            .attr("text-anchor", "middle")
            .style("font-size", "16px")
            .style("font-weight", "bold")
            .text("Displacement Distribution");


        // Tooltip
        var tooltip = d3
            .select(this.target)
            .append("div")
            .attr("class", "tooltip")
            .style("position", "absolute")
            .style("opacity", 0)
            .style("pointer-events", "none");


        // Click
        canvas.addEventListener("click", (event: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;

            // Find the closest point to the mouse
            const closest = data.reduce((prev, curr) => {
                const prevDist = Math.hypot(xScale(prev.degree) - mouseX, yScale(prev.elevation) - mouseY);
                const currDist = Math.hypot(xScale(curr.degree) - mouseX, yScale(curr.elevation) - mouseY);
                return currDist < prevDist ? curr : prev;
            });
            console.log(closest)
            // Show tooltip
            tooltip
                .style("opacity", 1)
                .style("left", `${event.clientX + 10}px`)
                .style("top", `${event.clientY + 10}px`)
                .html(
                    `Degree: ${closest.degree}<br>
                    Elevation: ${closest.elevation}<br>
                    Displacement: ${closest.displacement}`
                );
            return visualVerticalLine(data, closest, svg, viewport)

        });

        canvas.addEventListener("mouseout", () => {
            tooltip.style("opacity", 0);
        });
        this.renderInputBox();
        //#endregion
    }

    private renderButton(): void {
        const buttonSize = 20;
        d3.select(this.target).select("#reset-button").remove();
        d3.select(this.target)
            .append("div")
            .attr("id", "reset-button")
            .style("position", "absolute")
            .style("lelf", "300px")
            .style("top", "400px")
            .style("width", `${buttonSize}px`)
            .style("height", `${buttonSize}px`)
            .style("background-color", "#3a3a3a")
            .style("border-radius", "50%")
            .style("display", "flex")
            .style("justify-content", "center")
            .style("align-items", "center")
            .style("cursor", "pointer")
            .classed("reset-button", true)
            .html(`
                <svg xmlns="http://www.w3.org/2000/svg" fill="#fff" viewBox="0 0 24 24" width="12px" height="12px">
                    <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
                </svg>
            `)
            .on("click", () => {
                this.isInitialRender = true
                // this.startAnimation(this.isInitialRender);
            });
    }

    private renderInputBox(): void {
        // Remove existing input if any
        d3.select(this.target).select(".number-input-container").remove();

        // Add input box container
        var inputContainer = d3
            .select(this.target)
            .append("div")
            .attr("class", "number-input-container")
            .style("position", "absolute")
            .style("top", "100px")
            .style("right", "360px");

        // Add label
        inputContainer
            .append("label")
            .attr("for", "number-input")
            .text("Elevation (in) value: ")
            .style("margin-right", "5px")
            .style("font-size", "20px");

        // Add input box with placeholder
        var inputBox = inputContainer
            .append("input")
            .attr("type", "number")
            .attr("id", "number-input")
            .attr("min", "0") // Minimum value
            .attr("max", "1019") // Maximum value
            .attr("placeholder", "0-1019") // Add placeholder
            .style("width", "100px")
            .style("font-size", "16px")
            .style("padding", "5px");

        // Add warning message container
        const warning = inputContainer
            .append("div")
            .attr("class", "warning-message")
            .style("color", "red")
            .style("font-size", "14px")
            .style("margin-top", "5px")
            .style("display", "none") // Hidden by default
            .text("Value elevation must be between 0 and 1019!");

        // Handle input change
        inputBox.on("input", (event: Event) => {
            const value = Number((event.target as HTMLInputElement).value);

            // Check if value is within range
            if (value < 0 || value > 1019) {
                warning.style("display", "block"); // Show warning message
            } else {
                warning.style("display", "none"); // Hide warning message
                console.log("Input elevation:", value);

                // Perform actions based on input value
                this.updateCircleChartBasedOnInput(value);
            }
        });
    }

    // Example function to handle input value
    private updateCircleChartBasedOnInput(elevation: number): void {
        // Remove previous chart elements
        d3.select(this.target).select("g.text-group-1").remove();
        interface DataPoint {
            elevation: number;
            degree: number;
            displacement: number;
        }
        var coke_radius = 4800; // in mm
        var coke_radius_inch = coke_radius / 25.4;
        var initialRadius = 189
        // Filter data based on elevation
        const filteredData: DataPoint[] = this.data.filter((d: unknown) => {
            const point = d as DataPoint; // Ép kiểu rõ ràng
            return point.elevation === elevation;
        });
        console.log("input", filteredData)
        if (filteredData.length === 0) {
            console.log("No data found for elevation:", elevation);
            return;
        }

        // Set up SVG dimensions and scales
        const width = 600, height = 600;
        const centerX = 740 + width / 2, centerY = height / 2;
        const maxRadius = Math.min(width, height) / 2 - 200;

        var tooltip = d3
            .select(this.target)
            .append("div")
            .attr("class", "tooltip")
            .style("position", "absolute")
            .style("opacity", 0)
            .style("pointer-events", "none");
        const g = this.svg.append("g")
            .attr("transform", `translate(${centerX}, ${centerY})`);
        d3.select(this.target).selectAll(".data-point").remove();
        const textGroup1 = g.append("g").attr("class", "text-group-1");
        // d3.select("g.text-group-1").selectAll("text").remove();

        var rScale = d3
            .scaleLinear()
            .domain([
                coke_radius_inch - 189 - 5,
                coke_radius_inch - 189 - 3,
                coke_radius_inch - 189,
                coke_radius_inch - 189 + 3,
                coke_radius_inch - 189 + 5,
            ])
            .range([0, maxRadius / 2, maxRadius]);

        const degreesToRadians = (deg: number) => (deg * Math.PI) / 180;

        const maxDisplacement = d3.max(
            filteredData,
            (d) => d.displacement
        );
        const save_datamax = []
        for (let i = 0; i < 181; i++) {
            var dd = filteredData[i].displacement + filteredData[180 - i].displacement
            save_datamax.push(dd)
        }
        const minDisplacement = d3.min(filteredData, (d) => d.displacement);
        const ovality = 2 * (maxDisplacement - minDisplacement) / (maxDisplacement + minDisplacement)

        //Draw data points as circles
        g.selectAll(".data-point")
            .data(filteredData)
            .enter()
            .append("circle")
            .attr("class", "data-point")
            .attr("transform", function (d) {
                return (
                    "translate(" +
                    Math.cos(degreesToRadians(d.degree)) *
                    rScale(d.displacement - initialRadius) +
                    "," +
                    Math.sin(degreesToRadians(d.degree)) *
                    rScale(d.displacement - initialRadius) +
                    ")"
                );
            })
            .attr("r", 1.5) // Radius of the circle
            .attr("fill", "blue")
            .on("mouseover", function (event, d) {
                console.log(d.displacement)
                tooltip
                    .style("opacity", 1)
                    .style("color", "red")
                    .style("font-size", "16px")
                    .style("font-family", "Segoe Ui")
                    .style("font-weight", "bold")
                    .html(
                        `Radius (in): ${(d.displacement - initialRadius).toFixed(2)}<br>

                    Degree: ${d.degree.toFixed(2)}`
                    )

                    .style("left", event.pageX + 5 + "px")
                    .style("top", event.pageY - 28 + "px");

            })
            .on("mouseout", function () {
                tooltip.style("opacity", 0);
            });

        //Draw polar grid lines

        g.selectAll("circle-grid")
            .data([
                coke_radius_inch - 189 - 5,
                coke_radius_inch - 189 - 3,
                coke_radius_inch - 189,
                coke_radius_inch - 189 + 3,
                coke_radius_inch - 189 + 5,
            ])
            .enter()
            .append("circle")
            .attr("cx", 0)
            .attr("cy", 0)
            .attr("r", function (d) {
                return rScale(d);
            })
            .style("stroke", "lightgray")
            .style("fill", "none");

        textGroup1.selectAll("text")
            .data([
                // coke_radius_inch - 189 - 5,
                coke_radius_inch - 189 - 3,
                0,
                coke_radius_inch - 189 + 3,
                coke_radius_inch - 189 + 5,
            ])
            .enter()
            .append("text")
            .attr("x", 0)
            .attr("y", function (d) {
                return -rScale(d);
            })
            .attr("dy", "-0.15em")
            .attr("dx", "0.5em")
            .attr("text-anchor", "middle")
            .text(function (d) {
                return d.toFixed(0) + '';
            });
        textGroup1.append("text")
            .attr("x", width / 50 - 60)
            .attr("y", height / 2)
            .attr("text-anchor", "lefl")
            .text(`Max = ${maxDisplacement}`);
        textGroup1.append("text")
            .attr("x", width / 50 - 60)
            .attr("y", height / 2 + 20)
            .attr("text-anchor", "lefl")
            .text(`Min = ${minDisplacement}`);
        textGroup1.append("text")
            .attr("x", width / 50 - 60)
            .attr("y", height / 2 + 40)
            .attr("text-anchor", "lefl")
            .text(`Ovality (%) = ${(ovality * 100).toFixed(3)}`);
        const numberOfLines = 12;
        g.selectAll("line")
            .data(d3.range(0, 360, 360 / numberOfLines))
            .enter()
            .append("line")
            .attr("x1", 0)
            .attr("x2", 0)
            .attr("y1", 0)
            .attr("y2", -190)
            .attr("transform", function (d) {
                return "rotate(" + d + ")";
            })
            .style("stroke", "lightgray")
            .style("fill", "none");
        textGroup1.selectAll("text")
            .data(
                [0, 0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330],
                function (d) {
                    return d; // Use the data value as the unique key
                }
            )
            .enter()
            .append("text")
            .attr("x", function (d) {
                return Math.cos(degreesToRadians(d)) * (210);
            })
            .attr("y", function (d) {
                return Math.sin(degreesToRadians(d)) * (210);
            })
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .text(function (d) {
                switch (d) {
                    case 0:
                        return "0° (W)";
                    case 90:
                        return "90° (N)";
                    case 180:
                        return "180° (E)";
                    case 270:
                        return "270° (S)";
                    default:
                        return d + "°";
                }
            });

    }

    public getFormattingModel(): FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.settings);
    }
}

function visualVerticalLine(data: { degree: number; elevation: number; displacement: number; }[], data_click: { degree: any; elevation: any; displacement: any; }, svg: d3.Selection<SVGGElement, unknown, null, undefined>, viewport: any): void {
    var currentElevation = data_click.elevation;
    var numElevation = 60;

    var width_chart = viewport.width / 1.16;
    var height_chart = viewport.height;
    svg.selectAll(".line-chart-group").remove();

    var h = svg
        .append("g")
        .attr("class", "line-chart-group")
        .attr("transform", "translate(" + width_chart + "," + 2 + ")");

    const dataArray = Object.values(data);
    const filteredData = dataArray.filter(
        (item) =>
            item.elevation >= currentElevation - numElevation / 2 &&
            item.elevation <= currentElevation + numElevation / 2 &&
            item.degree === data_click.degree
    );

    const width_line = 120;
    const height_line = 600;
    const margin = { top: 20, right: 30, bottom: 40, left: 50 };

    const displacementExtent = d3.extent(
        filteredData,
        (d) => d.displacement - 189
    );
    const adjustedExtent = [
        Math.min(displacementExtent[0] - 0.5, 0 - 0.5),
        Math.max(displacementExtent[1] + 0.5, 0 + 0.5),
    ];
    console.log(adjustedExtent);
    const xScale = d3
        .scaleLinear()
        .domain(adjustedExtent)
        .range([0, width_line]);

    const yScale = d3
        .scaleLinear()
        .domain(d3.extent(filteredData, (d) => d.elevation))
        .range([height_line, 0]);

    const xAxis = d3.axisBottom(xScale).ticks(4);
    const yAxis = d3.axisLeft(yScale).ticks(6);

    h.append("g")
        .attr("transform", `translate(0,${height_line})`)
        .style("font-family", "Arial")
        .style("font-size", "14px")
        .style("font-weight", "bold")

        .call(xAxis);

    h.append("g").call(yAxis)
        .style("font-family", "Arial")
        .style("font-size", "14px")
        .style("font-weight", "bold")



    h.append("text")
        .attr("x", width_line / 2)
        .attr("y", height_line + margin.bottom - 1)
        .attr("text-anchor", "middle")
        .text("Radius (in)");

    h.append("text")
        .attr("x", width_line / 2)
        .attr("y", -margin.bottom + 15)
        .attr("text-anchor", "middle")
        .text(`Φ=${data_click.degree}`);

    h.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -height_line / 1.8)
        .attr("y", -margin.left + 10)
        .attr("text-anchor", "middle")
        .style("font-family", "Segoe UI")
        // .style("font-weight", "bold")

        .style("font-size", "16px") //
        .style("fill", "black")
        .text("Elevation (in)");

    const line = d3
        .line<{ degree: number; elevation: number; displacement: number }>()
        .x((d) => xScale(d.displacement - 189))
        .y((d) => yScale(d.elevation));

    // Add Line Path
    h.append("path")
        .datum(filteredData)
        .attr("class", "line")
        .attr("fill", "none")
        .attr("stroke", "orange")
        .attr("stroke-width", 2)
        .attr("d", line);

    const maxDisplacement = d3.max(
        filteredData,
        (d) => d.displacement
    );

    const minDisplacement = d3.min(filteredData, (d) => d.displacement);
    const avgDisplacement =
        d3.mean(filteredData, (d) => d.displacement) || 0;
    if (maxDisplacement !== undefined) {
        console.log("Max Displacement:", maxDisplacement);
        h.append("line")
            .attr("x1", xScale(maxDisplacement - 189))
            .attr("x2", xScale(maxDisplacement - 189))
            .attr(
                "y1",
                yScale(d3.min(filteredData, (d) => d.elevation))
            )
            .attr(
                "y2",
                yScale(d3.max(filteredData, (d) => d.elevation))
            )
            .attr("stroke", "green")
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", "8 3");

        h.append("line")
            .attr("x1", xScale(0))
            .attr("x2", xScale(0))
            .attr(
                "y1",
                yScale(d3.min(filteredData, (d) => d.elevation))
            )
            .attr(
                "y2",
                yScale(d3.max(filteredData, (d) => d.elevation))
            )
            .attr("stroke", "black")
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "3 1.5");
    }
    h.append("text")
        .attr("x", width_line / 2 - 40)
        .attr("y", height_line + 80)
        .attr("text-anchor", "lefl")
        .text(`Max = ${(maxDisplacement - 189).toFixed(2)}`);
    h.append("text")
        .attr("x", width_line / 2 - 40)
        .attr("y", height_line + 100)
        .attr("text-anchor", "lefl")
        .text(`Min = ${(minDisplacement - 189).toFixed(2)}`);
    h.append("text")
        .attr("x", width_line / 2 - 40)
        .attr("y", height_line + 120)
        .attr("text-anchor", "lefl")

        .text(`Dif = ${(maxDisplacement - minDisplacement).toFixed(2)}`);
    console.log("can")

}





