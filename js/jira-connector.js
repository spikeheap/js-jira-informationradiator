/**
 Title: Wallboard for JIRA, tailored for a support-style set of metrics.
 Created by Ryan Brooks 

 This code is licensed under the GPLv3 license: http://www.gnu.org/licenses/gpl.html.

 Requirements:
 	* JQuery 1.9.1 or higher
 	* JQPlot
 	* Fittext

 Authentication has not been added yet, so you'll need to be logged in to the JIRA instance.
**/

var jiraURL='https://jira.example.com'

$(document).ready(function() {

	updateTwoDayDelta('project=Support and status=New', 'project=Support and status was New DURING (-1d,-1d)', '#toTriage', false);
	updateTwoDayDelta('project=Support and created > startOfDay()', 'project=Support and created < startOfDay() and created > startOfDay(-1d)', '#newIssues');
	updateTwoDayDelta('project=Support and updated > startOfDay()', 'project=Support and updated < startOfDay() and updated > startOfDay(-1d)', '#updatedIssues', true);
	updateTwoDayDelta('project=Support and resolved > startOfDay()', 'project=Support and resolved < startOfDay() and resolved > startOfDay(-1d)', '#resolvedIssues', true);

	tableOfIssues('project=Support and created > -1d', 'key,reporter,summary,priority', '#neglectedIssues');



	jqlQuery = 'project=Support and (created >= -31d OR resolved >= -31d)';
	$.ajax(jiraURL+'/rest/api/latest/search', {
		data: {
			jql: jqlQuery,
			fields: 'created,resolutiondate',
			maxResults: 400,
		},
		cache: false,
		dataType: 'jsonp',
		jsonp: 'jsonp-callback',
		success: function(json){

			createdMap = buildDateMap(json,"created", 31);
			resolvedMap = buildDateMap(json,"resolutiondate", 31);

			var fromJSONMap = function(){
				var data = [[],[],[]];
				var daysBefore = 31;
				var start = new Date();

				cumulativeCreated = 0;
				cumulativeResolved = 0;
				start.setDate(start.getDate() - daysBefore);
				for(i=0-daysBefore;i<=0;i++){     
       				
					key = start.getFullYear() +"/"+ (start.getMonth() +1) +"/"+ start.getDate();
					cumulativeCreated += createdMap[key];
					cumulativeResolved += resolvedMap[key];
					data[0].push([start.toDateString(), cumulativeCreated]);
					data[1].push([start.toDateString(), cumulativeResolved]);
					
					start.setDate(start.getDate() + 1);
    			}

    			return data;
			};

			$.jqplot('chartdiv', [], { 
				dataRenderer: fromJSONMap, 
				seriesColors: [ "#e21e18","#3ab739"],
				fillBetween: {
       			    // series1: Required, if missing won't fill.
       			    series1: 0,
       			    // series2: Required, if  missing won't fill.
       			    series2: 1,
       			    // color: Optional, defaults to fillColor of series1.
       			    color: "lightblue",// Atlassian Red is "#c4604d",
       			    // baseSeries:  Optional.  Put fill on a layer below this series
       			    // index.  Defaults to 0 (first series).  If an index higher than 0 is
       			    // used, fill will hide series below it.
       			    baseSeries: 0,
       			    // fill:  Optional, defaults to true.  False to turn off fill.  
       			    fill: true
       			},
			
    			axesDefaults: {
    			    tickRenderer: $.jqplot.CanvasAxisTickRenderer ,
    			    tickOptions: {
    			      //angle: -30,
    			      //fontSize: '10pt'
    			    }
    			},

    			axes: {
    			  xaxis: {
    			    //renderer: $.jqplot.CategoryAxisRenderer
    			    renderer:$.jqplot.DateAxisRenderer,
          			tickOptions:{
          			  formatString:'%b %#d'
          			} 
    			  }
    			}
			});
		},
		error: function(){},
	});
});

tableOfIssues= function(jqlQuery, fields){
	/** sample query to pull back a table of issues **/
	
	$.ajax(jiraURL+'/rest/api/latest/search', {
		data: {
			expand: 'reporter',
			jql: jqlQuery,
			fields: fields,
		},
		cache: false,
		dataType: 'jsonp',
		jsonp: 'jsonp-callback',
		success: function(json){
			if(json.issues.length == 0){
				$('#neglectedIssues tbody:last').append( $('<tr>')	
						.append( $('<td>').text("Woohoo! There's nothing to show!") )				);
			}else{
				$.each(json.issues, function(index, item){
					$('#neglectedIssues tbody:last').append( $('<tr>')
						.append( $('<td>').html("<img src='"+item.fields.reporter.avatarUrls["48x48"]+"' />") )
						.append( $('<td>').html("<img src='"+item.fields.priority.iconUrl+"' />") )
						.append( $('<td>').text(item.key).addClass("issueKey") )			
						.append( $('<td>').text(item.fields.summary) )				);
				});
			}
		},
		error: function(){},
	});
}

buildDateMap = function(json, dateField, daysBefore){
	
	/** Prepare map with dates **/
	newMap = {};
	var start = new Date();
	newMap[start.getFullYear() +"/"+ (start.getMonth() +1) +"/"+ start.getDate()] = 0;
    for(i=0;i<daysBefore;i++){     
		start.setDate(start.getDate() - 1);
		newMap[start.getFullYear() +"/"+ (start.getMonth() +1) +"/"+ start.getDate()] = 0;
		
    }

	$.each(json.issues, function(index, item){

		createdDate = new Date(item.fields[dateField]);
		key = createdDate.getFullYear() +"/"+ (createdDate.getMonth() +1) +"/"+ createdDate.getDate();
		if(newMap[key] != undefined){
			newMap[key]++;
		}
	});
	return newMap;
}

updateTwoDayDelta = function(jqlQueryDay1, jqlQueryDay2, widgetId, biggerIsBetter) {
	getCountOfIssues(jqlQueryDay1, function(result){
		var issuesToday = +result.total;
		$(widgetId + ' .result').text( issuesToday);
		$(widgetId + ' .result').fitText(0.125);
		getCountOfIssues(jqlQueryDay2, function(result){
			var issuesYesterday = +result.total;
			//$(widgetId + ' .delta').text( issuesToday - issuesYesterday);
			if(biggerIsBetter == true){
				if(issuesToday > issuesYesterday){
					$(widgetId).addClass('gettingBetter').addClass('up');
				}else{
					$(widgetId).addClass('gettingWorse').addClass('down');
				}
			}else if(biggerIsBetter == false){
				if(issuesToday < issuesYesterday){
					$(widgetId).addClass('gettingBetter').addClass('down');
				}else{
					$(widgetId).addClass('gettingWorse').addClass('up');
				}
			}
		}, function(result){
			$('#newIssues' + ' .delta').text( "N/A" );
		});

	}, function(result){
		$('#newIssues' + ' .result').text( "N/A" );
	});
}

getCountOfIssues = function(jqlQuery, success, error) {
 	
	// Query JIRA
	$.ajax(jiraURL+'/rest/api/latest/search', {
		data: {
			jql: jqlQuery,
			fields: 'key',
		},
		cache: false,
		dataType: 'jsonp',
		jsonp: 'jsonp-callback',
		success: success,
		error: error,
	});
 }