Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    config: {
        defaultSettings: {
            keepTypesAligned: true
        }
    },
    getSettingsFields: function() {
        var returned = [
        {
            name: 'keepTypesAligned',
            xtype: 'rallycheckboxfield',
            fieldLabel: 'Columnised Types',
            labelAlign: 'top'
        },
        {
            name: 'hideArchived',
            xtype: 'rallycheckboxfield',
            fieldLabel: 'Hide Archived',
            labelAlign: 'top'
        }
        ];
        return returned;
    },
    itemId: 'rallyApp',
        MIN_COLUMN_WIDTH:   200,        //Looks silly on less than this
        MIN_ROW_HEIGHT: 20 ,                 //
        LOAD_STORE_MAX_RECORDS: 100, //Can blow up the Rally.data.wsapi.filter.Or
        WARN_STORE_MAX_RECORDS: 300, //Can be slow if you fetch too many
        NODE_CIRCLE_SIZE: 8,                //Pixel radius of dots
        LEFT_MARGIN_SIZE: 100,               //Leave space for "World view" text
        STORE_FETCH_FIELD_LIST:
            [
                'Name',
                'FormattedID',
                'Parent',
                'DragAndDropRank',
                'Children',
                'ObjectID',
                'Project',
                'DisplayColor',
                'Owner',
                'Blocked',
                'BlockedReason',
                'Ready',
                'Tags',
                'Workspace',
                'RevisionHistory',
                'CreationDate',
                'PercentDoneByStoryCount',
                'PercentDoneByStoryPlanEstimate',
                'State',
                'PreliminaryEstimate',
                'Description',
                'Notes',
                'Predecessors',
                'Successors',
                'OrderIndex',   //Used to get the State field order index
                //Customer specific after here. Delete as appropriate
                'c_ProjectIDOBN',
                'c_QRWP',
                'c_RAGStatus',
                'c_ProgressUpdate'
            ],
        CARD_DISPLAY_FIELD_LIST:
            [
                'Name',
                'Owner',
                'PreliminaryEstimate',
                'Parent',
                'Project',
                'PercentDoneByStoryCount',
                'PercentDoneByStoryPlanEstimate',
                'State',
                'c_ProjectIDOBN',
                'c_QRWP',
                'c_RAGStatus'

            ],

    items: [
        {
            xtype: 'container',
            itemId: 'rootSurface',
            margin: '5 5 5 5',
            layout: 'auto',
            title: 'Loading...',
            autoEl: {
                tag: 'svg'
            },
            listeners: {
                afterrender:  function() {  gApp = this.up('#rallyApp'); gApp._onElementValid(this);},
            },
            visible: false
        }
    ],
    //Set the SVG area to the surface we have provided
    _setSVGSize: function(surface) {
        var svg = d3.select('svg');
        svg.attr('width', surface.getEl().dom.clientWidth);
        svg.attr('height',surface.getEl().dom.clientHeight);
    },
    _nodeTree: null,
    //Continuation point after selectors ready/changed
    _enterMainApp: function() {

        gApp._initialiseD3();
    console.log('Enter main app');
        //Get all the nodes
        gApp._nodes = gApp._nodes.concat(gApp._createMyNodes());
        var nodetree = gApp._createTree(gApp._nodes);

        //It is hard to calculate the exact size of the tree so we will guess here
        //When we try to use a 'card' we will need the size of the card

        var numColumns = (gApp._highestOrdinal()+1); //Leave extras for offset at left and text at right
        var columnWidth = this.getSize().width/numColumns;
        columnWidth = columnWidth > gApp.MIN_COLUMN_WIDTH ? columnWidth : gApp.MIN_COLUMN_WIDTH;
        treeboxHeight = (nodetree.leaves().length +1) * gApp.MIN_ROW_HEIGHT;

        var current = gApp.colourBoxSize;
        var viewBoxSize = [columnWidth*numColumns < current[0]?current[0]:columnWidth*numColumns, 
                treeboxHeight< current[1]? current[1]: treeboxHeight];

        //Make surface the size available in the viewport (minus the selectors and margins)
        var rs = this.down('#rootSurface');
        rs.getEl().setWidth(viewBoxSize[0]);
        rs.getEl().setHeight(viewBoxSize[1]);
        //Set the svg area to the surface
        this._setSVGSize(rs);
        // Set the dimensions in svg to match
        var svg = d3.select('svg');
        svg.attr('class', 'rootSurface');
        svg.attr('preserveAspectRatio', 'none');
        svg.attr('viewBox', '0 0 ' + viewBoxSize[0] + ' ' + (viewBoxSize[1]+ gApp.NODE_CIRCLE_SIZE));

        gApp._nodeTree = nodetree;      //Save for later
        g = svg.append("g")        .attr("transform","translate(" + gApp.LEFT_MARGIN_SIZE + ",10)")
            .attr("id","tree");
        //For the size, the tree is rotated 90degrees. Height is for top node to deepest child
        var tree = null;
        if (this.getSetting('keepTypesAligned')) {
            tree = d3.tree()
                .size([viewBoxSize[1], viewBoxSize[0] - (columnWidth + (2*gApp.LEFT_MARGIN_SIZE))])     //Take off a chunk for the text??
                .separation( function(a,b) {
                        return ( a.parent == b.parent ? 1 : 1); //All leaves equi-distant
                    }
                );
        }
        else {
             tree = d3.cluster()
                .size([viewBoxSize[1], viewBoxSize[0] - (columnWidth + (2*gApp.LEFT_MARGIN_SIZE))])     //Take off a chunk for the text??
                .separation( function(a,b) {
                        return ( a.parent == b.parent ? 1 : 1); //All leaves equi-distant
                    }
                );
        }
        tree(nodetree);
        gApp.tree = tree;
        gApp._refreshTree();
    },
    _refreshTree: function(){
        var g = d3.select('#tree');
        var nodetree = gApp._nodeTree;

         g.selectAll(".link")
            .data(nodetree.descendants().slice(1))
            .enter().append("path")
            .attr("class", function(d) { return d.data.invisibleLink? "invisible--link" :  "local--link" ;})
            .attr("d", function(d) {
                    return "M" + d.y + "," + d.x
                        + "C" + (d.parent.y + 100) + "," + d.x
                        + " " + (d.parent.y + 100) + "," + d.parent.x
                        + " " + d.parent.y + "," + d.parent.x;
            })
            ;
        var node = g.selectAll(".node")
            .data(nodetree.descendants())
            .enter().append("g")
            .attr("transform", function(d) { return "translate(" + d.y + "," + d.x + ")"; });

        //We're going to set the colour of the dot depndent on some criteria (in this case only in-progress
        node.append("circle")
            .attr("r", gApp.NODE_CIRCLE_SIZE)
            .attr("class", function (d) {   //Work out the individual dot colour
                var lClass = "dotOutline"; // Might want to use outline to indicate something later
                if (d.data.record.data.ObjectID){
                    if (!d.data.record.get('State')) return "error--node";      //Not been set - which is an error in itself
                    lClass +=  ' q' + ((d.data.record.get('State').OrderIndex-1) + '-' + gApp.numStates[gApp._getOrdFromModel(d.data.record.get('_type'))]); 
                } else {
                    return d.data.error ? "error--node": "no--errors--done";
                }
                return lClass;
            })
            .on("click", function(node, index, array) { gApp._nodeClick(node,index,array);})
            .on("mouseover", function(node, index, array) { gApp._nodeMouseOver(node,index,array);})
            .on("mouseout", function(node, index, array) { gApp._nodeMouseOut(node,index,array);});

        node.append("text")
              .attr("dy", 3)
              .attr("visible", false)
              .attr("x", function(d) { return gApp._textXPos(d);})
              .attr("y", function(d) { return gApp._textYPos(d);})
//              .style("text-anchor", "start" )
              .style("text-anchor",  function(d) { return gApp._textAnchor(d);})
              .text(function(d) {  return d.children?d.data.Name : d.data.Name + ' ' + (d.data.record && d.data.record.data.Name); });

        //Now put in, but hide, all the dependency links
//        node.addPredecessors(g.selectAll("circle"));
//        node.addSuccessors();
    },
    _textXPos: function(d){
        return d.children ? -(gApp.NODE_CIRCLE_SIZE + 5) : (gApp.NODE_CIRCLE_SIZE + 5);
    },

    _textYPos: function(d){
        return (d.children  && d.parent) ? -(gApp.NODE_CIRCLE_SIZE + 5) : 0;
    },

    _textAnchor: function(d){
//        if (d.children && d.parent) return 'middle';
        if (!d.children && d. parent) return 'start';
        return 'end';
    },

    _nodeMouseOut: function(node, index,array){
        if (node.card) node.card.hide();
    },

    _nodeMouseOver: function(node,index,array) {
        if (!(node.data.record.data.ObjectID)) {
            //Only exists on real items, so do something for the 'unknown' item
            return;
        } else {

            if ( !node.card) {
                var card = Ext.create('Rally.ui.cardboard.Card', {
                    'record': node.data.record,
                    fields: gApp.CARD_DISPLAY_FIELD_LIST,
                    constrain: false,
                    width: gApp.MIN_COLUMN_WIDTH,
                    height: 'auto',
                    floating: true,
                    shadow: false,
                    showAge: true,
                    resizable: true,
                    listeners: {
                        show: function(card){
                            //Move card to one side, preferably closer to the centre of the screen
                            var xpos = array[index].getScreenCTM().e - gApp.MIN_COLUMN_WIDTH;
                            var ypos = array[index].getScreenCTM().f;
                            card.el.setLeftTop( (xpos - gApp.MIN_COLUMN_WIDTH) < 0 ? xpos + gApp.MIN_COLUMN_WIDTH : xpos - gApp.MIN_COLUMN_WIDTH, 
                                (ypos + this.getSize().height)> gApp.getSize().height ? gApp.getSize().height - (this.getSize().height+20) : ypos)  //Tree is rotated
                        }
                    }

                });
                node.card = card;
            }
            node.card.show();
        }
    },

    _nodeClick: function (node,index,array) {
        if (!(node.data.record.data.ObjectID)) return; //Only exists on real items
        //Get ordinal (or something ) to indicate we are the lowest level, then use "UserStories" instead of "Children"
        var childField = node.data.record.hasField('Children')? 'Children' : 'UserStories';
        var model = node.data.record.hasField('Children')? node.data.record.data.Children._type : 'UserStory';

        Ext.create('Rally.ui.dialog.Dialog', {
            autoShow: true,
            draggable: true,
            closable: true,
            width: 1100,
            height: 800,
                    overflowY: 'scroll',
                    overflowX: 'none',
            record: node.data.record,
            disableScroll: false,
            model: model,
            childField: childField,
            title: 'Information for ' + node.data.record.get('FormattedID') + ': ' + node.data.record.get('Name'),
            layout: 'hbox',
            items: [
                {
                    xtype: 'container',
                    itemId: 'leftCol',
                    width: 500,
                },
                // {
//                    xtype: 'container',
//                    itemId: 'middleCol',
//                    width: 400
//                },
                {
                    xtype: 'container',
                    itemId: 'rightCol',
                    width: 580  //Leave 20 for scroll bar
                }
            ],
            listeners: {
                afterrender: function() {
                    this.down('#leftCol').add(
                        {
                                xtype: 'rallycard',
                                record: this.record,
                                fields: gApp.CARD_DISPLAY_FIELD_LIST,
                                showAge: true,
                                resizable: true
                        }
                    );

                    if ( this.record.get('c_ProgressUpdate')){
                        this.down('#leftCol').insert(1,
                            {
                                xtype: 'component',
                                width: '100%',
                                autoScroll: true,
                                html: this.record.get('c_ProgressUpdate')
                            }
                        );
                        this.down('#leftCol').insert(1,
                            {
                                xtype: 'text',
                                text: 'Progress Update: ',
                                style: {
                                    fontSize: '13px',
                                    textTransform: 'uppercase',
                                    fontFamily: 'ProximaNova,Helvetica,Arial',
                                    fontWeight: 'bold'
                                },
                                margin: '0 0 10 0'
                            }
                        );
                    }
                    //This is specific to customer. Features are used as RAIDs as well.
                    if ((this.record.self.ordinal === 1) && this.record.hasField('c_RAIDType')){
                        var rai = this.down('#leftCol').add(
                            {
                                xtype: 'rallypopoverchilditemslistview',
                                target: array[index],
                                record: this.record,
                                childField: this.childField,
                                addNewConfig: null,
                                gridConfig: {
                                    title: '<b>Risks and Issues:</b>',
                                    enableEditing: false,
                                    enableRanking: false,
                                    enableBulkEdit: false,
                                    showRowActionsColumn: false,
                                    storeConfig: this.RAIDStoreConfig(),
                                    columnCfgs : [
                                        'FormattedID',
                                        'Name',
                                        'c_RAIDType',
                                        'State',
                                        'c_RAGStatus',
                                        'ScheduleState'
                                    ]
                                },
                                model: this.model
                            }
                        );
                        rai.down('#header').destroy();
                   }

                    var children = this.down('#leftCol').add(

                        {
                            xtype: 'rallypopoverchilditemslistview',
                            target: array[index],
                            record: this.record,
                            childField: this.childField,
                            addNewConfig: null,
                            gridConfig: {
                                title: '<b>Children:</b>',
                                enableEditing: false,
                                enableRanking: false,
                                enableBulkEdit: false,
                                showRowActionsColumn: false,
                                storeConfig: this.nonRAIDStoreConfig(),
                                columnCfgs : [
                                    'FormattedID',
                                    'Name',
                                    {
                                        text: '% By Count',
                                        dataIndex: 'PercentDoneByStoryCount'
                                    },
                                    {
                                        text: '% By Est',
                                        dataIndex: 'PercentDoneByStoryPlanEstimate'
                                    },
                                    'State',
                                    'c_RAGSatus',
                                    'ScheduleState'
                                ]
                            },
                            model: this.model
                        }
                    );
                    children.down('#header').destroy();

                    var cfd = Ext.create('Rally.apps.CFDChart', {
                        record: this.record,
                        container: this.down('#rightCol')
                    });
                    cfd.generateChart();

                    //Now add predecessors and successors
                    var preds = this.down('#rightCol').add(
                        {
                            xtype: 'rallypopoverchilditemslistview',
                            target: array[index],
                            record: this.record,
                            childField: 'Predecessors',
                            addNewConfig: null,
                            gridConfig: {
                                title: '<b>Predecessors:</b>',
                                enableEditing: false,
                                enableRanking: false,
                                enableBulkEdit: false,
                                showRowActionsColumn: false,
                                storeConfig: this.RAIDStoreConfig(),
                                columnCfgs : [
                                'FormattedID',
                                'Name',
                                {
                                    text: '% By Count',
                                    dataIndex: 'PercentDoneByStoryCount'
                                },
                                {
                                    text: '% By Est',
                                    dataIndex: 'PercentDoneByStoryPlanEstimate'
                                },
                                'State',
                                'c_RAGSatus',
                                'ScheduleState'
                                ]
                            },
                            model: this.model
                        }
                    );
                    preds.down('#header').destroy();
                    var succs = this.down('#rightCol').add(
                        {
                            xtype: 'rallypopoverchilditemslistview',
                            target: array[index],
                            record: this.record,
                            childField: 'Successors',
                            addNewConfig: null,
                            gridConfig: {
                                title: '<b>Successors:</b>',
                                enableEditing: false,
                                enableRanking: false,
                                enableBulkEdit: false,
                                showRowActionsColumn: false,
                                storeConfig: this.RAIDStoreConfig(),
                                columnCfgs : [
                                'FormattedID',
                                'Name',
                                {
                                    text: '% By Count',
                                    dataIndex: 'PercentDoneByStoryCount'
                                },
                                {
                                    text: '% By Est',
                                    dataIndex: 'PercentDoneByStoryPlanEstimate'
                                },
                                'State',
                                'c_RAGSatus',
                                'ScheduleState'
                                ]
                            },
                            model: this.model
                        }
                    );
                    succs.down('#header').destroy();
                }
            },

            //This is specific to customer. Features are used as RAIDs as well.
            nonRAIDStoreConfig: function() {
                if (this.record.hasField('c_RAIDType') ){
                    switch (this.record.self.ordinal) {
                        case 1:
                            return  {
                                filters: {
                                    property: 'c_RAIDType',
                                    operator: '=',
                                    value: ''
                                }
                            };
                        default:
                            return {};
                    }
                }
                else return {};
            },

            //This is specific to customer. Features are used as RAIDs as well.
            RAIDStoreConfig: function() {
                var retval = {};

                if (this.record.hasField('c_RAIDType') && this.record.hasField('c_RAGStatus')){
                            return {
                                filters: [{
                                    property: 'c_RAIDType',
                                    operator: '!=',
                                    value: ''
                                },
                                {
                                    property: 'c_RAGStatus',
                                    operator: '=',
                                    value: 'RED'
                                }]
                            };
                    }
                    else return {};
                }
            });
    },

    //Entry point after creation of render box
    _onElementValid: function(rs) {
        //Add any useful selectors into this container ( which is inserted before the rootSurface )
        //Choose a point when all are 'ready' to jump off into the rest of the app
        var hdrBox = this.insert (0,{
            xtype: 'container',
            itemId: 'headerBox',
            layout: 'hbox',
            items: [
                {
                    xtype: 'container',
                    itemId: 'filterBox'
                },
                {
                    xtype:  'rallyportfolioitemtypecombobox',
                    itemId: 'piType',
                    fieldLabel: 'Choose Lowest Portfolio Type :',
                    labelWidth: 100,
                    margin: '5 0 5 20',
                    defaultSelectionPosition: 'first',
                    storeConfig: {
                        sorters: {
                            property: 'Ordinal',
                            direction: 'ASC'
                        }
                    },
                    listeners: {
                        select: function() { gApp._kickOff();}    //Jump off here to add portfolio size selector
                    }
                },
            ]
        });
    },
    numStates: [],
    colourBoxSize: null,

    _addColourHelper: function() {
        var hdrBox = gApp.down('#headerBox');
        var numColours = gApp._highestOrdinal() + 1;
        var modelList = gApp._getTypeList(0);  //Get from bottom to top

        //Get the SVG surface and add a new group
        var svg = d3.select('svg');
        //Set a size big enough to hold the colour palette (which may get bigger later)
        gApp.colourBoxSize = [gApp.MIN_COLUMN_WIDTH*numColours, 10 * gApp.MIN_ROW_HEIGHT];  //Start with 10 states per type

        //Make surface the size available in the viewport (minus the selectors and margins)
        var rs = this.down('#rootSurface');
        rs.getEl().setWidth(gApp.colourBoxSize[0]);
        rs.getEl().setHeight(gApp.colourBoxSize[1]);
        //Set the svg area to the surface
        this._setSVGSize(rs);
        // Set the view dimensions in svg to match
        svg.attr('class', 'rootSurface');
        svg.attr('preserveAspectRatio', 'none');
        svg.attr('viewBox', '0 0 ' + gApp.colourBoxSize[0] + ' ' + (gApp.colourBoxSize[1]+ gApp.NODE_CIRCLE_SIZE));
        var colours = svg.append("g")    //New group for colours
            .attr("id", "colourLegend")
            .attr("transform","translate(" + gApp.LEFT_MARGIN_SIZE + ",10)");
        //Add some legend specific sprites here

        _.each(modelList, function(modeltype, idx) {
            gApp._addColourBox(modeltype,idx);
        });

    },

    _addColourBox: function(modeltype, modelNum) {
//        var colourBox = d3.select('#colourLegend' + modelNum);
        var colours = d3.select('#colourLegend');
//        if (!colourBox) {
            colours.append("g")
                .attr("id", "colourLegend" + modelNum)
                .attr("transform","translate(" + (gApp.MIN_COLUMN_WIDTH*modelNum) + ",10)");
//        }
        var colourBox = d3.select('#colourLegend' + modelNum);
            var lCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            colourBox.append("text")
                .attr("dx", -gApp.NODE_CIRCLE_SIZE )
                .attr("dy", -(gApp.NODE_CIRCLE_SIZE+2))
                .attr("x",  0)
                .attr("y", 0)
//              .style("text-anchor", "start" )
                .style("text-anchor",  'start')
                .text(modeltype.Name);

            //Now fetch all the values for the State field
            //And then add the colours
            var typeStore = Ext.create('Rally.data.wsapi.Store',
                {
                    model: 'State',
                    filters: [{
                        property: 'TypeDef',
                        value: modeltype.ref
                    },
                    {
                        property: 'Enabled',
                        value: true
                    }],
                    context: gApp.getContext().getDataContext(),
                    fetch: true
                }
            );
            typeStore.load().then({ 
                success: function(records){
                        gApp.numStates[modelNum] = records.length;  //Save for drawing other circles
                            _.each(records, function(state){
                                var idx = state.get('OrderIndex');
                                colourBox.append("circle")
                                    .attr("cx", 0)
                                    .attr("cy", idx * gApp.MIN_ROW_HEIGHT)    //Leave space for text of name
                                    .attr("r", gApp.NODE_CIRCLE_SIZE)
                                    .attr("class", "q" + (state.get('OrderIndex')-1) + '-' + records.length)
                                colourBox.append("text")
                                    .attr("dx", gApp.NODE_CIRCLE_SIZE+2)
                                    .attr("dy", gApp.NODE_CIRCLE_SIZE/2)
                                    .attr("x",0)
                                    .attr("y",idx * gApp.MIN_ROW_HEIGHT)
                                    .attr("text-anchor", 'start')
                                    .text(state.get('Name'));
                            })
                        },
                failure: function(error) {
                    debugger;
                }
            });
        
       colours.attr("visibility","hidden");    //Render, but mask it. Use "visible" to show again
    },

    _onFilterReady: function(inlineFilterPanel) {
        gApp.insert(1,inlineFilterPanel);
    },

    _onFilterChange: function(inlineFilterButton) {
        console.log('filterchange');
        gApp._filterInfo = inlineFilterButton.getTypesAndFilters();
        gApp._fireFilterPanelEvent();
    },

    _nodes: [],
    _filterPanel: false,

    //We don't want the initial setup firing of the event
    _fireFilterPanelEvent: function() {
        if (!gApp._filterPanel) {
            gApp._filterPanel = true;
        }
        else {
            gApp._kickOff();
        }
    },

    _kickOff: function() {
        var ptype = gApp.down('#piType');
        gApp._typeStore = ptype.store;

        if (!gApp._filterPanel){
            gApp._addFilterPanel();
        }
        var hdrBox = gApp.down('#headerBox');
        var buttonTxt = "Colour Codes"
        if (!gApp.down('#colourButton')) {
            hdrBox.add({
                xtype: 'rallybutton',
                itemId: 'colourButton',
                margin: '5 0 5 20',
                ticked: false,
                text: buttonTxt,
                handler: function() {
                    if (this.ticked === false) {
                        this.setText('Return');
                        this.ticked = true;
                        d3.select("#colourLegend").attr("visibility","visible");
                        d3.select("#tree").attr("visibility", "hidden");
                    } else {
                        this.setText(buttonTxt)
                        this.ticked = false;
                        d3.select("#colourLegend").attr("visibility","hidden");
                        d3.select("#tree").attr("visibility", "visible");
                    }
                }
            });
            gApp._addColourHelper();
        }
        gApp._getArtifacts(ptype);
    },

    _addFilterPanel: function() {
            var hdrBox = gApp.down('#headerBox');
            //Add a filter panel
            var blackListFields = ['Successors', 'Predecessors', 'DisplayColor'],
                whiteListFields = ['Milestones', 'Tags'];
            var modelNames = [];
            for ( var i = 0; i <= gApp._highestOrdinal(); i++){
                modelNames.push(gApp._getModelFromOrd(i));
            }
            hdrBox.add({
                xtype: 'rallyinlinefiltercontrol',
                itemId: 'filterPanel',
                context: this.getContext(),
                margin: '5 0 0 60',
                height: 26,
                inlineFilterButtonConfig: {
                    stateful: true,
                    stateId: this.getContext().getScopedStateId('inline-filter'),
                    context: this.getContext(),
                    modelNames: modelNames,
                    filterChildren: false,
                    inlineFilterPanelConfig: {
                        quickFilterPanelConfig: {
                            defaultFields: ['ArtifactSearch', 'Owner'],
                            addQuickFilterConfig: {
                                blackListFields: blackListFields,
                                whiteListFields: whiteListFields
                            }
                        },
                        advancedFilterPanelConfig: {
                            advancedFilterRowsConfig: {
                                propertyFieldConfig: {
                                    blackListFields: blackListFields,
                                    whiteListFields: whiteListFields
                                }
                            }
                        }
                    },
                    listeners: {
                        inlinefilterchange: this._onFilterChange,
                        inlinefilterready: this._onFilterReady,
                        scope: this
                    }
                }
            });
    },

    _getArtifacts: function(ptype) {
    console.log('getArtifacts');
        //On re-entry remove all old stuff
        if ( gApp._nodes) gApp._nodes = [];
        if (gApp._nodeTree) {
            d3.select("#tree").remove();
            gApp._nodeTree = null;
        }
        //Starting with lowest selected by the combobox, go up
        var typeRecord = ptype.getRecord();
        var modelNumber = typeRecord.get('Ordinal');
        var typeRecords = ptype.store.getRecords();
        gApp._loadStoreLocal( typeRecords[modelNumber].get('TypePath')).then({
            success: function(dataArray) {
                if (dataArray.length >= gApp.WARN_STORE_MAX_RECORDS) {
                    Rally.ui.notify.Notifier.showWarning({message: 'Excessive limit of first level records. Narrow your scope '});
                }
                //Start the recursive trawl upwards through the levels
                gApp._loadParents(dataArray, modelNumber);
            },
            failure: function(error) {
                console.log("Failed to load a store");
            }
        });
    },

    _loadParents: function(data, modelNumber) {
    console.log('loadParents: ', data);
        var parentModelNumber = modelNumber + 1;
        if ((data.length == 0)  ){
            //No more parents available, so branch off
            gApp._enterMainApp();
        }
        else {
            gApp._nodes = gApp._nodes.concat(gApp._createNodes(data));
            if (parentModelNumber > gApp._highestOrdinal()) {
                //No more parents to find, so branch off. This can happen if the user does not have permission to get the parents
                gApp._enterMainApp();
            }
            else {
                //Now create list for parents and find those
                var parentsToFind = [];
                _.each(data, function(record) {
                    var pObj = record.get('Parent') && record.get('Parent').ObjectID;
                    if (pObj) {
                        parentsToFind.push({'property': 'ObjectID', 'value': pObj});
                    }
                });
                parentsToFind = _.uniq(parentsToFind, function(p) { return p.value});
                //Do those have any parents to look for
                if (parentsToFind.length) {
                    gApp._loadStoreGlobal(gApp._getModelFromOrd(parentModelNumber), parentsToFind).then({
                        success: function (dArray) {
                            // After multiple fetches, we need to reduce down to a single level of array nesting
                            gApp._loadParents(_.flatten(dArray), parentModelNumber);
                        },
                        failure: function(error) {
                            console.log('Oops!');
                        }
                    });
                }
                else {
                    //No more parents to find, so branch off
                    gApp._enterMainApp();
                }
            }
        }
    },

    _loadStoreLocal: function(modelName) {
        var storeConfig =
            {
                model: modelName,
                limit: 20000,
                fetch:  gApp.STORE_FETCH_FIELD_LIST
            };
        if (gApp._filterInfo && gApp._filterInfo.filters.length) {
            storeConfig.filters = gApp._filterInfo.filters;
            storeConfig.models = gApp._filterInfo.types;
        }
        var store = Ext.create('Rally.data.wsapi.Store', storeConfig);
        return store.load();
    },

    //Load some artifacts from the global arena as a promise
    _loadStoreGlobal: function(modelName, parents) {
        var loadPromises = [];
        var config = {
            model: modelName,
            pageSize: gApp.LOAD_STORE_MAX_RECORDS,
            context: {
                workspace: gApp.getContext().getWorkspaceRef(),
                project: null
            },
            fetch:  gApp.STORE_FETCH_FIELD_LIST
        };
        while (parents.length) {
            var wConf = Ext.clone(config);
            wConf.pageSize = parents.length >= gApp.LOAD_STORE_MAX_RECORDS ? gApp.LOAD_STORE_MAX_RECORDS : parents.length;
            //Get the filters from the array
            wConf.filters = Rally.data.wsapi.Filter.or(_.first(parents, wConf.pageSize));
            parents = _.rest(parents, wConf.pageSize);
            var store = Ext.create('Rally.data.wsapi.Store', wConf);
            loadPromises.push(store.load());
        }
        return Deft.Promise.all(loadPromises);
    },
    _createNodes: function(data) {
        //These need to be sorted into a hierarchy based on what we have. We are going to add 'other' nodes later
        var nodes = [];
        //Push them into an array we can reconfigure
        _.each(data, function(record) {
            var localNode = (gApp.getContext().getProjectRef() === record.get('Project')._ref);
            nodes.push({'Name': record.get('FormattedID'), 'record': record, 'local': localNode});
        });
        return nodes;
    },

    _createMyNodes: function() {
        var nodes = [];
        //Create a node for d3 to hook onto
        nodes.push({'Name': 'World View',
            'record': {
                'data': {
                    '_ref': 'root',
                    'Name': ''
                }
            },
            'local':true
        });
        //Now push some entries to handle "parent-less" artefacts. This should create a 'tree' branch of parentless things
        _.each(gApp._getTypeList(gApp._getSelectedOrdinal()+1), function(typedef) {
            nodes.push( { 'Name' : 'Unknown ' + typedef.Name,
                'record': {
                    'data': {
                            'FormattedID' : 'Parent Not Set',
                            'Name': 'Missing Parent (' + typedef.Name + ')',
                            '_ref': '/' + typedef.type + '/null',
                            '_type': typedef.type,
                            'Parent': null
                    }
                },
                'local': true,
                'error': true,       //Might want to highlight these in the UI
                'invisibleLink' : true
            });
        });
        return nodes;
    },
    _findNode: function(nodes, record) {
        var returnNode = null;
            _.each(nodes, function(node) {
                if ((node.record && node.record.data._ref) === record._ref){
                     returnNode = node;
                }
            });
        return returnNode;

    },
    _findParentType: function(record) {
        //The only source of truth for the hierachy of types is the typeStore using 'Ordinal'
        var ord = null;
        for ( var i = 0;  i < gApp._typeStore.totalCount; i++ )
        {
            if (record.data._type === gApp._typeStore.data.items[i].get('TypePath').toLowerCase()) {
                ord = gApp._typeStore.data.items[i].get('Ordinal');
                break;
            }
        }
        ord += 1;   //We want the next one up, if beyond the list, set type to root
        //If we fail this, then this code is wrong!
        if ( i >= gApp._typeStore.totalCount) {
            return null;
        }
        var typeRecord =  _.find(  gApp._typeStore.data.items, function(type) { return type.get('Ordinal') === ord;});
        return (typeRecord && typeRecord.get('TypePath').toLowerCase());
    },
    _findNodeById: function(nodes, id) {
        return _.find(nodes, function(node) {
            return node.record.data._ref === id;
        });
    },
    _findParentNode: function(nodes, child){
        if (child.record.data._ref === 'root') return null;
        var parent = child.record.data.Parent;
        var pParent = null;
        if (parent ){
            //Check if parent already in the node list. If so, make this one a child of that one
            //Will return a parent, or null if not found
            pParent = gApp._findNode(nodes, parent);
        }
        else {
            //Here, there is no parent set, so attach to the 'null' parent.
            var pt = gApp._findParentType(child.record);
            //If we are at the top, we will allow d3 to make a root node by returning null
            //If we have a parent type, we will try to return the null parent for this type.
            if (pt) {
                var parentName = '/' + pt + '/null';
                pParent = gApp._findNodeById(nodes, parentName);
            }
        }
        //If the record is a type at the top level, then we must return something to indicate 'root'
        return pParent?pParent: gApp._findNodeById(nodes, 'root');
    },
        //Routines to manipulate the types

     _getTypeList: function(lowestOrdinal) {
        var piModels = [];
        _.each(gApp._typeStore.data.items, function(type) {
            //Only push types above that selected
            if (type.data.Ordinal >= lowestOrdinal )
                piModels.push({ 'type': type.data.TypePath.toLowerCase(), 'Name': type.data.Name, 'ref': type.data._ref});
        });
        return piModels;
    },

    _highestOrdinal: function() {
        return _.max(gApp._typeStore.data.items, function(type) { return type.get('Ordinal'); }).get('Ordinal');
    },
    _getModelFromOrd: function(number){
        var model = null;
        _.each(gApp._typeStore.data.items, function(type) { if (number == type.get('Ordinal')) { model = type; } });
        return model && model.get('TypePath');
    },

    _getSelectedOrdinal: function() {
        return gApp.down('#piType').lastSelection[0].get('Ordinal')
    },

    _getOrdFromModel: function(modelName){
        var model = null;
        _.each(gApp._typeStore.data.items, function(type) {
            if (modelName == type.get('TypePath').toLowerCase()) {
                model = type.get('Ordinal');
            }
        });
        return model;
    },

    _createTree: function (nodes) {
        //Try to use d3.stratify to create nodet
        var nodetree = d3.stratify()
                    .id( function(d) {
                        var retval = (d.record && d.record.data._ref) || null; //No record is an error in the code, try to barf somewhere if that is the case
                        return retval;
                    })
                    .parentId( function(d) {
                        var pParent = gApp._findParentNode(nodes, d);
                        return (pParent && pParent.record && pParent.record.data._ref); })
                    (nodes);
        return nodetree;
    },
    launch: function() {
        //API Docs: https://help.rallydev.com/apps/2.1/doc/
    },

    _initialiseD3: function() {
        d3.selection.prototype.addPredecessors = function  (nodes) {
            return this.each(function(node, index, array) {
                var record = node.data.record;
                if (record.data.ObjectID && record.get('Predecessors').Count) {    //Only real ones have this
                    record.getCollection('Predecessors').load().then({
                        success: function(preds) {
                            _.each(preds, function(pred){
                            debugger;
                                var pn = _.find(nodes.nodes, function(d) {
                                    return d.data.record && (d.data.record.data._ref === pred.get('_ref'));
                                });
                                pn.append("path")
                                    .attr("class", "predecessor--link")
                                    .attr("d", function(d) {
                                        return "M" + d.y + "," + d.x
                                            + "C" + (node.y + 100) + "," + d.x
                                            + " " + (node.y + 100) + "," + node.x
                                            + " " + node.y + "," + node.x;
                                })

                            });
                        },
                        failure: function(error) {
                            debugger;
                        }
                    });
                }
            });
        }
        d3.selection.prototype.addSuccessors = function  () {
            return this.each(function(node, index, array) {
                debugger;
            });
        }
    }
});