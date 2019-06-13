/*
 *  Power BI Visualizations
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */

module powerbi.extensibility.visual {
    // d3
    import Selection = d3.Selection;
    import UpdateSelection = d3.selection.Update;

    // powerbi.extensibility.utils.svg
    import ClassAndSelector = powerbi.extensibility.utils.svg.CssConstants.ClassAndSelector;
    import createClassAndSelector = powerbi.extensibility.utils.svg.CssConstants.createClassAndSelector;

    export interface ITableView {
        data(data: any[], dataIdFunction: (d) => {}, dataAppended: boolean): ITableView;
        rowHeight(rowHeight: number): ITableView;
        columnWidth(columnWidth: number): ITableView;
        rows(rows: number): ITableView;
        columns(columns: number): ITableView;
        viewport(viewport: IViewport): ITableView;
        render(): void;
        empty(): void;
        computedColumns: number;
        computedRows: number;
    }

    export module TableViewFactory {
        export function createTableView(options): ITableView {
            return new TableView(options);
        }
    }

    export interface TableViewViewOptions {
        enter: (selection: Selection<any>) => void;
        exit: (selection: Selection<any>) => void;
        update: (selection: Selection<any>) => void;
        baseContainer: Selection<any>;
        rowHeight: number;
        columnWidth: number;
        rows: number;
        columns: number;
        viewport: IViewport;
        scrollEnabled: boolean;
    }

    export interface TableViewGroupedData {
        data: any[];
        totalColumns: number;
        totalRows: number;
    }

    export interface TableViewComputedOptions {
        columns: number;
        rows: number;
    }

    /**
     * A UI Virtualized List, that uses the D3 Enter, Update & Exit pattern to update rows.
     * It can create lists containing either HTML or SVG elements.
     */
    export class TableView implements ITableView {
        public static RowSelector: ClassAndSelector = createClassAndSelector('row');
        public static CellSelector: ClassAndSelector = createClassAndSelector('cell');

        private static defaultRowHeight = 0;
        private static defaultColumns = 1;

        private getDatumIndex: (d: any) => {};
        private _data: any[];
        private _totalRows: number;
        private _totalColumns: number;

        private options: TableViewViewOptions;
        private visibleGroupContainer: Selection<any>;
        private scrollContainer: Selection<any>;

        private computedOptions: TableViewComputedOptions;

        public constructor(options: TableViewViewOptions) {
            // make a copy of options so that it is not modified later by caller
            this.options = $.extend(true, {}, options);

            this.options.baseContainer
                .style('overflow-y', 'auto')
                .attr('drag-resize-disabled', true);

            this.scrollContainer = options.baseContainer
                .append('div')
                .attr('class', 'scrollRegion');

            this.visibleGroupContainer = this.scrollContainer
            //     .append('div')
                // .attr('class', 'visibleGroup');

            TableView.SetDefaultOptions(options);
        }

        private static SetDefaultOptions(options: TableViewViewOptions) {
            options.rowHeight = options.rowHeight || TableView.defaultRowHeight;
        }

        public get computedColumns(): number {
            return this.computedOptions
                ? this.computedOptions.columns
                : 0;
        }

        public get computedRows(): number {
            return this.computedOptions
                ? this.computedOptions.rows
                : 0;
        }

        public rowHeight(rowHeight: number): TableView {
            this.options.rowHeight = Math.ceil(rowHeight);

            return this;
        }

        public columnWidth(columnWidth: number): TableView {
            this.options.columnWidth = Math.ceil(columnWidth);

            return this;
        }

        public rows(rows: number): TableView {
            this.options.rows = Math.ceil(rows);

            return this;
        }

        public columns(columns: number): TableView {
            this.options.columns = Math.ceil(columns);

            return this;
        }

        public data(data: any[], getDatumIndex: (d) => {}, dataReset: boolean = false): ITableView {
            this._data = data;
            this.getDatumIndex = getDatumIndex;
            this.setTotalRows();

            if (dataReset) {
                $(this.options.baseContainer.node()).scrollTop(0);
            }
            
            // console.log(this._data, this.getDayOfYear());

            return this;
        }

        private isLeapYear() {
            let year = new Date().getFullYear();
            if(year % 400 === 0) return true;
            else if((year % 100 !== 0) && (year % 4 === 0)) return true
            else return false
        }

        private getDayOfYear() {
            let dayCount = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
            let mn = new Date().getMonth();
            let dn = new Date().getDate();
            let dayOfYear = dayCount[mn] + dn;
            if(mn > 1 && this.isLeapYear()) dayOfYear++;
            return dayOfYear;
        }

        public viewport(viewport: IViewport): ITableView {
            this.options.viewport = viewport;

            return this;
        }

        public empty(): ITableView {
            this._data = [];
            this.render();

            return this;
        }

        private setTotalRows(): void {
            let count: number = this._data.length,
                rows: number = Math.min(this.options.rows, count),
                columns: number = Math.min(this.options.columns, count);

            if ((columns > 0) && (rows > 0)) {
                this._totalColumns = columns;
                this._totalRows = rows;
            } else if (rows > 0) {
                this._totalRows = rows;
                this._totalColumns = Math.ceil(count / rows);
            } else if (columns > 0) {
                this._totalColumns = columns;
                this._totalRows = Math.ceil(count / columns);
            } else {
                this._totalColumns = TableView.defaultColumns;
                this._totalRows = Math.ceil(count / TableView.defaultColumns);
            }
        }

        private getGroupedData(): TableViewGroupedData {
            let options: TableViewViewOptions = this.options,
                groupedData: any[] = [],
                totalItems: number = this._data.length,
                totalRows: number = options.rows > totalItems
                    ? totalItems
                    : options.rows,
                totalColumns: number = options.columns > totalItems
                    ? totalItems
                    : options.columns;

            if (totalColumns === 0 && totalRows === 0) {
                totalColumns = totalItems;
                totalRows = 1;
            } else if (totalColumns === 0 && totalRows > 0) {
                totalColumns = Math.ceil(totalItems / totalRows);
            } else if (totalColumns > 0 && totalRows === 0) {
                totalRows = Math.ceil(totalItems / totalColumns);
            }

            if (totalRows === 0) {
                totalRows = this._totalRows;
            }

            if (totalColumns === 0) {
                totalColumns = this._totalColumns;
            }


            let m: number = 0,
                k: number = 0;

            for (let i: number = 0; i < totalRows; i++) {
                if (options.columns === 0
                    && totalItems % options.rows > 0
                    && options.rows <= totalItems) {

                    if (totalItems % options.rows > i) {
                        m = i * Math.ceil(totalItems / options.rows);
                        k = m + Math.ceil(totalItems / options.rows);

                        this.addDataToArray(groupedData, this._data, m, k);
                    } else {
                        this.addDataToArray(groupedData, this._data, k, k + Math.floor(totalItems / options.rows));

                        k = k + Math.floor(totalItems / options.rows);
                    }
                } else {
                    let k: number = i * totalColumns;

                    this.addDataToArray(groupedData, this._data, k, k + totalColumns);
                }
            }

            this.computedOptions = this.getComputedOptions(groupedData);

            return {
                data: groupedData,
                totalColumns: totalColumns,
                totalRows: totalRows
            };
        }

        private addDataToArray(array: any[], data: any[], start: number, end: number): void {
            if (!array || !data) {
                return;
            }

            let elements: any[] = data.slice(start, end);

            if (elements && elements.length > 0) {
                array.push(elements);
            }
        }

        private getComputedOptions(data: any[]): TableViewComputedOptions {
            let rows: number,
                columns: number = 0;

            rows = data
                ? data.length
                : 0;

            for (let i: number = 0; i < rows; i++) {
                let currentRow: any[] = data[i];

                if (currentRow && currentRow.length > columns) {
                    columns = currentRow.length;
                }
            }

            return {
                columns: columns,
                rows: rows
            };
        }

        public render(): void {
            let options: TableViewViewOptions = this.options,
                visibleGroupContainer: Selection<any> = this.visibleGroupContainer,
                rowHeight: number = options.rowHeight || TableView.defaultRowHeight,
                groupedData: TableViewGroupedData = this.getGroupedData(),
                rowSelection: UpdateSelection<any>,
                cellSelection: UpdateSelection<any>;

            const elem = document.getElementById('sandbox-host');
            elem.style['overflow-y'] = 'hidden';
            elem.style.height = '100%';
            

            rowSelection = visibleGroupContainer
                .selectAll(TableView.RowSelector.selectorName)
                .data(<SampleSlicerDataPoint[]>groupedData.data);

            rowSelection
                .enter()
                .append("div")
                .classed(TableView.RowSelector.className, true);

            cellSelection = rowSelection
                .selectAll(TableView.CellSelector.selectorName)
                .data((dataPoints: SampleSlicerDataPoint[]) => {
                    return dataPoints;
                });

            cellSelection
                .enter()
                .append('div')
                .classed(TableView.CellSelector.className, true);


            cellSelection.call((selection: Selection<any>) => {
                options.enter(selection);
            });

            cellSelection.call((selection: Selection<any>) => {
                options.update(selection);
            });

            cellSelection.style({
                'height': (rowHeight > 0) ? rowHeight + 'px' : 'auto'
            });

            cellSelection.style({
                'width': (options.columnWidth > 0)
                    ? options.columnWidth + 'px'
                    : (100 / groupedData.totalColumns) + '%'
            });

            rowSelection.style({ 'width': null });


            cellSelection
                .exit()
                .remove();

            rowSelection
                .exit()
                .call(d => options.exit(d))
                .remove();
        }
    }

    
}
