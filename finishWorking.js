
document.addEventListener("DOMContentLoaded", function(){
	/** 
	* A new base record containing the most recent 
	*input form structure must exist on page load 
	*both online and offline
	*/
	finishWorking.checkForBaseRecord();
	
	/**
	* Comment this method out if you do not have a JavaScript service worker
	*/
	//finishWorking.initializeServiceWorker();
	
	finishWorking.listenForLossOfConnectivity();
});

document.addEventListener('click', function(event){
	if (event.target) {
		finishWorking.eventRouter(event);
	}
});

var finishWorking = (function(parent) {
    //var serviceWorkerVersion = version.v;
    
    /**
    * This is used in conjuction with a JavaScript service worker called sw.js located in your root folder
    * Add a service worker to your website so that your user's browsers will cache your website's resources
    * for offline usage/viewing.  This will allow your user's to navigate to and view your webpage while offline.
    */
    parent.initializeServiceWorker = function() {
        if ('serviceWorker' in navigator) { 
            navigator.serviceWorker.register('/sw.js', {scope: '/'}).then(function(registration) {
                registration.update();
            }, function(error) {
                console.log('Service worker registration failed:', error);
            });
        } else {
            console.log('Service workers are not supported.');
        }
    };
    
    /**
	* Use this function to get records for syncing.
	* Set recordType = 1 for page specific records.
	* Set recordType = 2 for all records from any page.
	* @param recordType	int
	*/
	parent.getRecordsForSync = function(recordType) {
		var url = parent.getUrl();
		var conditionals = {
			1: function (url, cursor) {
				return url === cursor.value.url;
			},
			2: function (url, cursor) {
				return true;
			}
		};
		
        var open = parent.initializeIdb();
        open.onsuccess = function() {
            var resources    = parent.dbResources(open);
			var records      = [];
            var getAll       = resources.store.openCursor(null);
            getAll.onsuccess = function(event) {
                var cursor = event.target.result;
                if (cursor) {
                    if (conditionals[Number(recordType)](url, cursor)
					 && !cursor.value.hasOwnProperty('baseRecord')) {
						records.push(cursor.value);
					}
                    cursor.continue();
                } else {
                    /* records is an array with all of the page specfic records */
                    /* Add your function to sync the records here */
                    /* For example, myWebsite.syncRecords(records); */
					
                    return false;
                }
            };
        };
	};
	
	parent.listenForLossOfConnectivity = function() {
	    var connectivityCounter = setInterval(function () {  
	        if (finishWorking.checkConnectivity()) {
	            clearInterval(connectivityCounter);
		        finishWorking.createButtonContainer();
		        finishWorking.initializeOfflineOption(false);
		        finishWorking.showSaveButton();
	        }
	    }, 5000);
	};
	
	/**
	* Use this function to delete all page specific records after a successfull sync
	*/
	parent.deleteRecordsAfterSuccessfulSync = function () {
	    var url  = parent.getUrl();
        var open = parent.initializeIdb();
        open.onsuccess = function () {
            var resources    = parent.dbResources(open);
			var records      = [];
            var getAll       = resources.store.openCursor(null);
            getAll.onsuccess = function (event) {
                var cursor = event.target.result;
                if (cursor) {
                    if (url === cursor.value.url && !cursor.value.hasOwnProperty('baseRecord')) {						
						parent.deleteRecord(cursor.value.id);
					}
                    cursor.continue();
                }
            };
        };
	};
	
	parent.deleteRecord = function(id) {
	    var open = parent.initializeIdb();
        open.onsuccess = function() {
            var resources = parent.dbResources(open);
            var request   = resources.store.delete(Number(id));
            request.onsuccess = function(event) {
				
                return false;
            };

            request.onerror = function(event) {
                parent.renderAlert('Error', 2);
            };
            parent.storageTransactionComplete(resources);
        };
	};

	parent.eventRouter = function(event) {
		var id = event.target.getAttribute("data-finishWorkingOnClick");
		var obj = {
			'finishWorking_saveButton': function() {
				finishWorking.initializeSave();
			},
			'finishWorking_editButton': function() {
				finishWorking.initializeSave();
			},
			'finishWorking_addButton': function() {
				finishWorking.getBaseRecord();
			},
			'finishWorking_recordCountContainer': function() {
				finishWorking.renderUserInterface();
			},
			'finishWorking_modalWindowCloseBtn': function() {
				finishWorking.removeElement('finishWorking_userInterfaceContainer');
			},
			'finishWorking_edit': function(event) {
				finishWorking.getRecordForPage(event);
			},
			'finishWorking_remove': function(event) {
				finishWorking.removeRecord(event);
			}
		};
		
		if (obj.hasOwnProperty(id)) {
			obj[id](event);
		}
	};
	
	parent.entryTypeRouter = function(record) {
		var id = record.type.toLowerCase();
		var obj = {
			'text': function(record) {
				finishWorking.populateInputFields(record);
			},
			'number': function(record) {
				finishWorking.populateInputFields(record);
			},
			'hidden': function(record) {
				finishWorking.populateInputFields(record);
			},
			'checkbox': function(record) {
				finishWorking.populateCheckboxFields(record);
			},
			'radio': function(record) {
				finishWorking.populateCheckboxFields(record);
			},
			'select-one': function(record) {
				finishWorking.populateSelectFields(record);
			},
			'select-multiple': function(record) {
				finishWorking.populateSelectFields(record);
			},
			'textarea': function(record) {
				finishWorking.populateInputFields(record);
			}
		};
		
		if (obj.hasOwnProperty(id)) {
			obj[id](record);
		}
	};
	
	parent.checkForBaseRecord = function() { 
		var url  = parent.getUrl();
        var open = parent.initializeIdb();
        open.onsuccess = function() {
            var resources    = parent.dbResources(open);
            var getAll       = resources.store.openCursor(null);
            getAll.onsuccess = function(event) {
                var cursor = event.target.result;
                if (cursor) {
                    if (url === cursor.value.url 
						&& cursor.value.hasOwnProperty('baseRecord')
						&& 1 === Number(cursor.value.baseRecord)
				    ) {
						parent.deleteOldBaseRecord(cursor.value.id);
					} 
					
				    cursor.continue();
                } else {
                    parent.createBaseRecord();
                }
            };
        };
	};
	
	parent.deleteOldBaseRecord = function(id) {
	    var open = parent.initializeIdb();
        open.onsuccess = function() {
            var resources = parent.dbResources(open);
            var request   = resources.store.delete(Number(id));
            request.onsuccess = function(event) {
                return false;
            };

            request.onerror = function(event) {
                parent.renderAlert('Error', 2);
            };
            parent.storageTransactionComplete(resources);
        };
	};
	
	parent.createBaseRecord = function() {
		var dataObj = {
			url: parent.getUrl(),
			dateTime: parent.dateTimeStamp(),
			form: parent.getForm(),
			data: "",
			baseRecord: 1
		};
		parent.saveBaseEntries(dataObj);
	};
	
	parent.saveBaseEntries = function(dataObj) {
        var open = parent.initializeIdb();
        open.onsuccess = function() {
            var resources = parent.dbResources(open);
            var request   = resources.store.add(dataObj);
            request.onsuccess = function(event) {
                return false;
            };
            parent.storageTransactionComplete(resources);
        };

        open.onerror = function() {
            if (true === showErrorMsg) {
                parent.renderAlert('Error', 2);
                return false;
            }
        };
    };
	
	parent.populateCheckboxFields = function(record) {
		document.querySelector('#' + record.id).checked = false;
		if (1 === Number(record.value)) {
			document.querySelector('#' + record.id).checked = true;
		}
	};
	
	parent.populateInputFields = function(record) {
		document.querySelector('#' + record.id).value 
			= record.value;
	};
	
	parent.populateSelectFields = function(record) {
		for (var i1 = 0; i1 <= record.value.length; i1++) {
			var list = document.querySelector('#' + record.id);
			for(var i2 = 0; i2 < list.options.length; i2++) {
				if (Number(list.options[i2].value) === Number(record.value[i1])) {
					list.options[i2].selected = true;
				}
			}
		}
	};
	
	parent.removeRecord = function(elementClicked) {
		var id   = elementClicked.target.getAttribute("data-id");
		var open = parent.initializeIdb();
        open.onsuccess = function() {
            var resources = parent.dbResources(open);
            var request   = resources.store.delete(Number(id));
            request.onsuccess = function(event) {
				parent.renderAlert('Deleted', 1);
                parent.renderUserInterface();
				parent.initializeOfflineOption(false);
				
                return false;
            };

            request.onerror = function(event) {
                parent.renderAlert('Error', 2);
            };
            parent.storageTransactionComplete(resources);
        };
	};
	
	parent.getRecordForPage = function(event) {
		var id   = event.target.getAttribute("data-id");
		var open = parent.initializeIdb();
        open.onsuccess = function() {
            var resources    = parent.dbResources(open);
            var getAll       = resources.store.openCursor(null);
            getAll.onsuccess = function(event) {
                var cursor = event.target.result;
                if (cursor) {
                    if (Number(id) === Number(cursor.value.id)) {
						parent.renderFormAndPageData(cursor.value);
						
						return false;
					}
                    cursor.continue();
                }
            };
			parent.storageTransactionComplete(resources);
        };
	};
	
	parent.getBaseRecord = function() { 
		var url  = parent.getUrl();
        var open = parent.initializeIdb();
        open.onsuccess = function() {
            var resources    = parent.dbResources(open);
            var getAll       = resources.store.openCursor(null);
            getAll.onsuccess = function(event) {
                var cursor = event.target.result;
                if (cursor) {
                    if (url === cursor.value.url 
						&& cursor.value.hasOwnProperty('baseRecord')
						&& 1 === Number(cursor.value.baseRecord)) {
						parent.resetForm(cursor.value);
						
						return false;
					} else {
						cursor.continue();
					}
                } 
            };
        };
	};
	
	parent.resetForm = function(record) {
		parent.removeElement('finishWorking_userInterfaceContainer');
		parent.removeElement('finishWorking_offlineRecordId');
		document.querySelector('.finishWorking_form').innerHTML 
			= record.form;
		parent.showSaveButton();
	};
	
	parent.renderFormAndPageData = function(record) {
		parent.removeElement('finishWorking_userInterfaceContainer');
		document.querySelector('.finishWorking_form').innerHTML 
			= record.form;
		for (var id in record.data) {
			if (record.data.hasOwnProperty(id)) {
				parent.entryTypeRouter(record.data[id]);
			}
		}
		parent.appendRecordId(record);
		if (document.querySelector("#finishWorking_saveButton")) {
	        document.querySelector("#finishWorking_saveButton")
		        .addEventListener("click", finishWorking.initializeSave);
		}
		
		if (document.querySelector("#finishWorking_editButton")) {
	        document.querySelector("#finishWorking_editButton")
		        .addEventListener("click", finishWorking.initializeSave);
		}
		
		parent.showEditButton();
	};
	
	parent.initializeOfflineOption = function(count) {
		if (false === count) {
			parent.countPageSpecificRecords();
		} else {
			if (count > 0) {
				parent.renderOfflineOption(count);
				parent.renderNewPageOption();
			} else if (0 === Number(count)) {
				parent.removeElement('finishWorking_recordCountContainer');
				parent.removeElement('finishWorking_editButton');
			}
		}
	};
	
	parent.appendRecordId = function(record) {
		if (!document.querySelector('#finishWorking_offlineRecordId')) {
			var input = document.createElement("input");
			input.setAttribute("type", "hidden");
			input.id = "finishWorking_offlineRecordId";
			document.body.appendChild(input);
		}
		
		document.querySelector('#finishWorking_offlineRecordId').value = record.id;
	};
	
	parent.renderUserInterface = function() {
		parent.removeElement('finishWorking_userInterfaceContainer');
		var outerDiv                   = document.createElement("div");
		outerDiv.id                    = "finishWorking_userInterfaceContainer";
		outerDiv.style.display         = "block";
		outerDiv.style.position        = "fixed";
		outerDiv.style.zIndex          = 999998;
		outerDiv.style.paddingTop      = "100px";
		outerDiv.style.left            = 0;
		outerDiv.style.top             = 0;
		outerDiv.style.width           = "100%";
		outerDiv.style.height          = "100%";
		outerDiv.style.overflow        = "auto";
		outerDiv.style.backgroundColor = "rgb(0,0,0)";
		outerDiv.style.backgroundColor = "rgba(0,0,0,0.4)"; 
		outerDiv.style.fontFamily      = "Arial, Helvetica, sans-serif";
		
		var innnerDiv                   = document.createElement("div");   
		innnerDiv.id                    = "finishWorking_modalWindow";   
		innnerDiv.style.borderRadius    = "5px";
		innnerDiv.style.border          = "1px solid #888";
		innnerDiv.style.width           = "80%";
		innnerDiv.style.padding         = "5px 10px 50px 10px";
		innnerDiv.style.margin          = "auto auto 200px auto";
		innnerDiv.style.backgroundColor = "#fefefe";
		
		var closeBtnSpan              = document.createElement("a"); 
		closeBtnSpan.id               = "finishWorking_modalWindowCloseBtn";
		closeBtnSpan.href             = "#void";
		closeBtnSpan.setAttribute('data-finishWorkingOnClick', 'finishWorking_modalWindowCloseBtn');
		closeBtnSpan.style.display    = "block";
		closeBtnSpan.style.float      = "right";
		closeBtnSpan.style.fontWeight = "bold";
		closeBtnSpan.style.zIndex     = 100000;
		closeBtnSpan.innerHTML        = "&times;";
		closeBtnSpan.style.cursor     = "Pointer";
		closeBtnSpan.style.fontSize   = "30px";
		closeBtnSpan.style.top        = "-5px";
		closeBtnSpan.style.color      = "inherit";
		closeBtnSpan.style.position   = "relative";
		closeBtnSpan.style.textDecoration = "none";
		closeBtnSpan.setAttribute("title", "Close this window");
		
		var textDiv                   = document.createElement("div");
		textDiv.id                    = "finishWorking_modalWindowTextCont";  
		textDiv.style.width           = "100%";
		textDiv.style.overflowY       = "auto";
	 
		document.body.appendChild(outerDiv);
		document.querySelector('#finishWorking_userInterfaceContainer').appendChild(innnerDiv);
		document.querySelector('#finishWorking_modalWindow').appendChild(closeBtnSpan);
		document.querySelector('#finishWorking_modalWindow').appendChild(textDiv);
		
		parent.createTableOfRecords(false);
	};
	
	parent.createTableTitle = function() {
		return '<div style="color: #ccc;"><b>Offline Storage Table:</b></div>';
	};
	
	parent.createTableOfRecords = function(option) {
		if (false === option) {
			parent.getPageSpecificRecords();
		} else {
			if (0 === option.length) {
				parent.removeElement('finishWorking_userInterfaceContainer');
				finishWorking.getBaseRecord();
				parent.removeElement('finishWorking_addButton');
			} else {
				document
					.querySelector('#finishWorking_modalWindowTextCont')
					.innerHTML = parent.createTableTitle() + '<table ' + parent.recordsTableCss() + '>' +
						parent.createTitleHeader(option) +
						parent.createTableHeader() +
						parent.createTableRows(option) +
						'</table>';
		    }
		}
	};
	
	parent.tableButtonTemplate = function() {
		return 'style="' +
				'text-decoration: none; ' + 
				'margin-right: 10px; ' +
				'font-weight: bold; ' +
				'"';
	};
	
	parent.createTableRows = function(option) {
		var css  = parent.recordsTableRowsCss();
		var rows = '';
		
		for (var i = 0; i < option.length; i++) {
			rows += '<tr>' +
				'<td ' + css + '>' +
				'<a href="#void" ' +
				'title="Edit entry"' + 
				parent.tableButtonTemplate() + 
				'data-finishWorkingOnClick="finishWorking_edit" ' +
				'data-id="' + option[i].id + '">Edit</a>' +
				'<a href="#void" ' +
				'title="Delete entry"' + 
				parent.tableButtonTemplate() + 
				'data-finishWorkingOnClick="finishWorking_remove" ' +
				'data-id="' + option[i].id + '">Remove</a>' +
				'</td>' +
				'<td ' + css + '>' +
				option[i].dateTime +
				'</td>' +
				'</tr>';
		}
		
		return rows;
	};
	
	parent.createTitleHeader = function(option) {
		var css = parent.recordsTableTitleRowsCss();
		return '<tr>' +
			'<th ' + css + ' colspan="2">Records Entered on Page ' + option[0].url + '</th>' +
			'<tr>';
	};
	
	parent.createTableHeader = function() {
		var css = parent.recordsTableHeaderRowsCss();
		return '<tr>' +
			'<th ' + css + '>Actions</th>' +
			'<th ' + css + '>Date and Time Record was Entered/Updated on this Page</th>' +
			'<tr>';
	};
	
	parent.removeElement = function(string) {
		if (document.querySelector('#' + string)) {
            document.querySelector('#' + string).remove();
        }
	};
	
	parent.createButtonContainer = function() {
		parent.removeElement('finishWorking_buttonContainer');
		var container                   = document.createElement("div");
        container.id                    = "finishWorking_buttonContainer";
		container.style.position        = "fixed";
		container.style.bottom          = "0";
		container.style.backgroundColor = "none";
		container.style.width           = "99%";
		container.style.fontFamily      = "Arial, Helvetica, sans-serif";
		container.style.padding         = "10px 0";
		container.style.fontWeight      = "bold";
		container.style.fontSize        = "16px";
		container.style.zIndex          = "9999";
		document.body.appendChild(container);
	};
	
	parent.showSaveButton = function() {
		parent.removeElement('finishWorking_editButton');
		parent.removeElement('finishWorking_saveButton');			
		var currentButtons = document.querySelector('#finishWorking_buttonContainer').innerHTML;
		document.querySelector('#finishWorking_buttonContainer').innerHTML 
			= currentButtons + '<a ' +
			'href="#void" ' +
			'id="finishWorking_saveButton" ' +
			'title="Click to save your new entry" ' +
			'data-finishWorkingOnClick="finishWorking_saveButton" ' +
			parent.buttonStyling() +
			'>Save</a>'; 
	};
	
	parent.showEditButton = function() {
		parent.removeElement('finishWorking_saveButton');
		parent.removeElement('finishWorking_editButton');		
		var currentButtons = document.querySelector('#finishWorking_buttonContainer').innerHTML;
		document.querySelector('#finishWorking_buttonContainer').innerHTML 
			= currentButtons + '<a ' +
			'href="#void" ' +
			'id="finishWorking_editButton" ' +
			'title="Click to save your offline changes" ' +
			'data-finishWorkingOnClick="finishWorking_editButton" ' +
			parent.buttonStyling() +
			'>Save Changes</a>'; 
	};
	
	parent.renderNewPageOption = function() {
		parent.removeElement('finishWorking_addButton');
		var currentButtons = document.querySelector('#finishWorking_buttonContainer').innerHTML;
		document.querySelector('#finishWorking_buttonContainer').innerHTML 
			= currentButtons + '<a ' +
			'href="#void" ' +
			'id="finishWorking_addButton" ' +
			'title="Click to reset input form" ' +
			'data-finishWorkingOnClick="finishWorking_addButton" ' +
			parent.buttonStyling() +
			'>Reset</a>';
	};
	
	parent.renderOfflineOption = function(count) {
		parent.removeElement('finishWorking_recordCountContainer');
		var currentButtons = document.querySelector('#finishWorking_buttonContainer').innerHTML;
		document.querySelector('#finishWorking_buttonContainer').innerHTML 
			= currentButtons + '<a ' +
			'href="#void" ' +
			'id="finishWorking_recordCountContainer" ' +
			'title="You have ' + count + ' offline entries" ' +
			'data-finishWorkingOnClick="finishWorking_recordCountContainer" ' +
			parent.buttonStyling() +
			'>' + count + '</a>'; 
	};
	
	parent.buttonStyling = function() {
		return 'style="float: left; ' +
			'display: block; ' +
			'border-radius: 10px; ' +
			'padding: 0 10px; ' +
			'margin-right: 5px; ' +
			'text-align: center; ' +
			'color: #ffffff; ' +
			'cursor: pointer; ' +
			'text-decoration: none;' +
			'background-color: #6699cc; ' +
			'line-height: 2em;"';
	};
	
	parent.checkConnectivity = function() {
		return !navigator.onLine && document.querySelector('.finishWorking_form');
	};
	
	parent.initializeSave = function() {
		if (parent.checkConnectivity()) {
			parent.getFormData();
		}
	};
	
	parent.dateTimeStamp = function() {
        var currentdate = new Date();
		
        return pad(currentdate.getMonth() + 1) + "/"
            + pad(currentdate.getDate()) + "/"
            + pad(currentdate.getFullYear()) + " "
            + pad(currentdate.getHours()) + ":"
            + pad(currentdate.getMinutes()) + ":"
            + pad(currentdate.getSeconds());

        function pad(n){
            return n < 10 ? "0" + n : n;
        };
    };
	
	parent.getFormData = function() {
		var obj = {};
		var dataObj = {
			url: parent.getUrl(),
			dateTime: parent.dateTimeStamp(),
			form: parent.getForm(),
			data: ""
		};
		
		obj = parent.getTypeInput(obj);
		obj = parent.getTypeSelect(obj);
		obj = parent.getTypeCheckbox(obj);
		obj = parent.getTypeTextarea(obj);
		obj = parent.getTypeRadioButton(obj);
		dataObj.data = obj;
		
		if (!document.querySelector('#finishWorking_offlineRecordId')) {
			parent.saveEntries(dataObj);
		} else {
			dataObj["id"] = Number(document.querySelector('#finishWorking_offlineRecordId').value);
			parent.editEntries(dataObj);
		}
	};
	
	parent.getForm = function() {
		return document.querySelector('.finishWorking_form').innerHTML;
	};
	
	parent.getTypeRadioButton = function(dataObj) {
		var elem = document.querySelectorAll("input[type='radio']");
		for (var i = 0; i < elem.length; i += 1) {
			var checkStatus = 0;
			if (true === elem[i].checked) {
				checkStatus = 1;
			}
			
			dataObj[elem[i].id] = {
				value: checkStatus,
				name: elem[i].name,
				id: elem[i].id,
				node: elem[i].nodeName,
				type: elem[i].type
			};
		}
		
		return dataObj;
	};
	
	parent.getTypeCheckbox = function(dataObj) {
		var elem = document.querySelectorAll("input[type='checkbox']");
		for (var i = 0; i < elem.length; i += 1) {
			var checkStatus = 0;
			if (true === elem[i].checked) {
				checkStatus = 1;
			}
			
			dataObj[elem[i].id] = {
				value: checkStatus,
				name: elem[i].name,
				id: elem[i].id,
				node: elem[i].nodeName,
				type: elem[i].type
			};
		}
		
		return dataObj;
	};
	
	parent.getTypeInput = function (dataObj) {
		var elem = document.getElementsByTagName('input');
		for (var i = 0; i < elem.length; i += 1) {
			if (elem[i].id !== "finishWorking_offlineRecordId") {
				dataObj[elem[i].id] = {
					value: elem[i].value,
					name: elem[i].name,
					id: elem[i].id,
					node: elem[i].nodeName,
					type: elem[i].type
				};
			}
		}
		
		return dataObj;
	};
	
	parent.getTypeTextarea = function(dataObj) {
		var elem = document.getElementsByTagName('textarea');
		for (var i = 0; i < elem.length; i += 1) {
			dataObj[elem[i].id] = {
				value: elem[i].value,
				name: elem[i].name,
				id: elem[i].id,
				node: elem[i].nodeName,
				type: elem[i].type
			};
		}
		
		return dataObj;
	};
	
	parent.getTypeSelect = function(dataObj) {
		var elem = document.getElementsByTagName('select');
		for (var i = 0; i < elem.length; i += 1) {
			var dataArray = [];
			for (var option of document.getElementById(elem[i].id).options) {
				if (option.selected) {
				  dataArray.push(option.value);
				}
			}
			
			dataObj[elem[i].id] = {
				value: dataArray,
				name: elem[i].name,
				id: elem[i].id,
				node: elem[i].nodeName,
				type: elem[i].type
			};
		}
		
		return dataObj;
	};
	
	parent.getUrl = function() {
		return location.pathname;
	};
	
	parent.getPageSpecificRecords = function() {
		var url  = parent.getUrl();
        var open = parent.initializeIdb();
        open.onsuccess = function() {
            var resources    = parent.dbResources(open);
			var records      = [];
            var getAll       = resources.store.openCursor(null);
            getAll.onsuccess = function(event) {
                var cursor = event.target.result;
                if (cursor) {
                    if (url === cursor.value.url && !cursor.value.hasOwnProperty('baseRecord')) {
						records.push(cursor.value);
					}
                    cursor.continue();
                } else {
                    parent.createTableOfRecords(records);
					
                    return false;
                }
            };
        };
    };
	
	parent.countPageSpecificRecords = function() {
		var url  = parent.getUrl();
        var open = parent.initializeIdb();
        open.onsuccess = function() {
            var resources    = parent.dbResources(open);
			var count        = 0;
            var getAll       = resources.store.openCursor(null);
            getAll.onsuccess = function(event) {
                var cursor = event.target.result;
                if (cursor) {
                    if (url === cursor.value.url && !cursor.value.hasOwnProperty('baseRecord')) {
						count++;
					}
                    cursor.continue();
                } else {
                    parent.initializeOfflineOption(count);
					
                    return false;
                }
            };
        };
    };
	
	parent.editEntries = function(dataObj) {
		var open = parent.initializeIdb();
        open.onsuccess = function() {
            var resources    = parent.dbResources(open);
            var getAll       = resources.store.openCursor(null);
            getAll.onsuccess = function(event) {
                var cursor = event.target.result;
                if (cursor) {
                    if (Number(cursor.value.id) === Number(dataObj.id)) {
						var request = cursor.update(dataObj);
                        request.onsuccess = function () {
                            parent.renderAlert('Updated', 1);

                            return false;
                        };
					}
                    cursor.continue();
                }
            };
			parent.storageTransactionComplete(resources);
        };

        open.onerror = function() {
            if (true === showErrorMsg) {
                parent.renderAlert('Error', 2);
                return false;
            }
        };
	};
	
	parent.saveEntries = function(dataObj) {
        var open = parent.initializeIdb();
        open.onsuccess = function() {
            var resources = parent.dbResources(open);
            var request   = resources.store.add(dataObj);
            request.onsuccess = function(event) {
                parent.renderAlert("Saved", 1);
                finishWorking.getBaseRecord();
				parent.initializeOfflineOption(false);
                return false;
            };
            parent.storageTransactionComplete(resources);
        };

        open.onerror = function() {
            if (true === showErrorMsg) {
                parent.renderAlert('Error', 2);
                return false;
            }
        };
    };
	
    parent.initializeIdb = function () {
        window.indexedDB      = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
        window.IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.msIDBTransaction;
        window.IDBKeyRange    = window.IDBKeyRange || window.webkitIDBKeyRange || window.msIDBKeyRange;
        if(!window.indexedDB){
            this.messages.renderMessage(this.messages.dbIncompatible);

            return false;
        } else {
            var request = window.indexedDB.open("finishWorking", 1);

            request.onerror = function(){
                window.indexedDB.deleteDatabase("finishWorking");
                parent.renderAlert('Error', 1);
            };

            request.onupgradeneeded = function(event) {
                if (Number(event.oldVersion) > 0
                    && (
                        Number(event.oldVersion) !== Number(1)
                    )
                ) {
                    window.indexedDB.deleteDatabase("finishWorking");
                } else {
                    var db = request.result;
                    var store = db.createObjectStore(
                        "objectStore",
                        {keyPath: "id", autoIncrement: true}
                    );				
					store.createIndex(
						"url",
						"url",
						{unique: false}
					);
                }
            };

            return request;
        }
    };
	
	parent.dbResources = function (openDb) {
        var db    = openDb.result;
        var tx    = db.transaction("objectStore", "readwrite");
        var store = tx.objectStore("objectStore");

        return {
            "db": db,
            "tx": tx,
            "store": store
        };
    };
	
	parent.renderAlert = function(msg, type) {
		var colorObj = {
			1: "#28a745",
			2: "#ff0000"
		};
		
		parent.removeElement('finishWorking_alertBox');
		var container                   = document.createElement("div");
		container.id                    = "finishWorking_alertBox";
		container.style.display         = "block";
		container.style.position        = "fixed";
		container.style.zIndex          = 999999;
		container.style.left            = "45%";
		container.style.top             = "50px";
		container.style.padding         = "30px";
		container.style.backgroundColor = colorObj[Number(type)]; 
		container.style.color           = "#ffffff";
		container.style.borderRadius    = "10px"; 		
		container.style.fontWeight      = "bold"; 
		container.style.fontFamily      = "Arial, Helvetica, sans-serif";
		document.body.appendChild(container);
		document.querySelector('#finishWorking_alertBox').innerHTML = '<span>' + msg + '</span>';
		setTimeout(function(){ parent.removeElement('finishWorking_alertBox'); }, 1000);
	};
	
    parent.storageTransactionComplete = function(resources){
        resources.tx.oncomplete = function() {
            resources.db.close();
        };
    };
	
	parent.recordsTableTitleRowsCss = function() {
		return 'style="border: solid 1px #333; text-align: left; background-color: #f3f3f3; color: #666666; font-weight: bold; padding: 10px;"';
	};
	
	parent.recordsTableHeaderRowsCss = function() {
		return 'style="background-color: #cccccc; border: solid 1px #333; text-align: left; padding: 10px;"';
	};
	
	parent.recordsTableRowsCss = function() {
		return 'style="border: solid 1px #333; text-align: left; padding: 10px;"';
	};
	
	parent.recordsTableCss = function() {
		return 'style="width: 100%; border-collapse: collapse"';
	};
	
	return parent;
}(finishWorking || {}));
