var loginData = null;
var allIDs = [];
var purgeIDs = [];
var list = [];
var kbdata = [];

var stasisList = [];
var purgedList = [];
var dnpList = [];
var notesList = {};

var purgeState = {
	Default: "",
	Stasis: "rgb(128, 128, 0)",
	Dnp: "rgb(128, 0, 0)",
	Purged: "rgb(0, 128, 0)",
};

var cMenu = $('#contextmenu');
var clickedID = "";

$('tbody').on("click", "tr", function(e) {
	var id = this.id.slice(3);
	
	switch ($(this).css('background-color')) {
		case purgeState.Dnp:
			$("#in-"+id).css('background-color', '');
			$("#kb-"+id).css('background-color', '');
			dnpList.splice(dnpList.indexOf(id), 1);
			break;
		case purgeState.Purged:
			$("#kb-"+id).css('background-color', purgeState.Dnp);
			$("#in-"+id).css('background-color', purgeState.Dnp);
			purgedList.splice(purgedList.indexOf(id), 1);
			dnpList.push(id);
			break;
		case purgeState.Stasis:
			$("#kb-"+id).css('background-color', purgeState.Purged);
			$("#in-"+id).css('background-color', purgeState.Purged);
			stasisList.splice(stasisList.indexOf(id), 1);
			purgedList.push(id);
			break;
		case purgeState.Default:
			console.log("Probably shouldn't ever see this");
			break;
		default:
			$("#kb-"+id).css('background-color', purgeState.Stasis);
			$("#in-"+id).css('background-color', purgeState.Stasis);
			stasisList.push(id);
			break;
	}
	
	localStorage.stasis = JSON.stringify(stasisList);
	localStorage.purged = JSON.stringify(purgedList);
	localStorage.dnp = JSON.stringify(dnpList);
});

$('tbody').on("contextmenu", "tr", function(e) {
	clickedID = this.id.slice(3);
	
	if (notesList[clickedID]) {
		$('#note-add').hide();
		$('#note-edit').show();
		$('#note-remove').show();
	} else {
		$('#note-add').show();
		$('#note-edit').hide();
		$('#note-remove').hide();
	}
	
	var posY = e.clientY;
	var posX = e.clientX;
	
	cMenu.css({"left":posX,"top":posY});
	cMenu.show();
	
	return false;
});

function saveNote() {
	notesList[clickedID] = $('#toon-note').val();
	$('#toon-note').val("");
	$('#in-' + clickedID).find('.has-note').show();
	$('#in-' + clickedID).find('.tool-tip-text').text(notesList[clickedID]);
	$('#kb-' + clickedID).find('.has-note').show();
	$('#kb-' + clickedID).find('.tool-tip-text').text(notesList[clickedID]);
	localStorage.notes = JSON.stringify(notesList);
}

function loadNote() {
	$('#toon-prefix').text("Edit the note for ");
	$('#toon-name').text(clickedID.replace(/-/gi, " "));
	$('#toon-note').val(notesList[clickedID]);
}

function removeNote() {
	delete notesList[clickedID];
	localStorage.notes = JSON.stringify(notesList);
	$('#in-' + clickedID).find('.has-note').hide();
	$('#kb-' + clickedID).find('.has-note').hide();
}

$(document).on("click", function(e) {
	cMenu.hide();
});

$('#logout').click(function() {
	localStorage.removeItem("loginData");
	location.reload();
});

$(document).ready(function() {
	// Load server status into header
	//serverStatus();
	
	// Load all of the stored values into memory
	if (localStorage.stasis)
		stasisList = JSON.parse(localStorage.stasis);
	if (localStorage.purged)
		purgedList = JSON.parse(localStorage.purged);
	if (localStorage.dnp)
		dnpList = JSON.parse(localStorage.dnp);
	if (localStorage.notes)
		notesList = JSON.parse(localStorage.notes);
	
	$('#nav-tabs').tabs();
	
	// Do we have a search location
	if (location.search) {
		// The user has logged in. Now we stash all the info we want and reload the web page.
		if (parseSearch("callback")) {
			var ex = Date.now() + (parseHash("expires_in")*1000);
			loginData =
			{
				token: parseHash("access_token"),
				expires: ex
			};
			localStorage.loginData = JSON.stringify(loginData);
			fetchCharInfo();
			return;
		}
	}
	
	// If login data exists, we need to make sure it's still valid.
	if (localStorage.loginData) {
		loginData = JSON.parse(localStorage.loginData);
		
		// If token has expired, then we need to log in again. Remove old data for funsies.
		if (loginData.expires < Date.now()) {
			localStorage.removeItem("loginData");
			showLogIn();
		}
		// Otherwise we're good to go. Let's load some thangs.
		else {
			$("#as").find("img").attr("src", "https://image.eveonline.com/Character/" + loginData.id + "_32.jpg");
			$("#corp-logo").attr("src", "https://image.eveonline.com/Corporation/" + loginData.corp_id + "_128.png");
			$("#logged-name").text("Logged in as " + loginData.name + ": ");
			$("#as").show();
			$("#corp-logo").show();
			
			setTimeout(tickTimer, 1000);
			
			if (loginData.has_roles == undefined)
				checkRoles();
			else
				loadThingsOntoPage();
		}
	}
	// Otherwise, we know they aren't logged in.
	else {
		showLogIn();
	}
});

// Show log in button and help text
function showLogIn() {
	$('#login').show();
	$('#please-login').show();
}

// Fire XHR request for server data
function serverStatus() {
	var fetch = new XMLHttpRequest();
	fetch.onload = serverStatusLoad;
	fetch.onerror = serverStatusError;
	fetch.open('get', "https://esi.evetech.net/latest/status/?datasource=tranquility", true);
	fetch.send();
}

// Catch server data response
function serverStatusLoad() {
	var data = JSON.parse(this.responseText);
	var isOn = data.players > 0;
	$('#server-status').text("Server is " + (isOn ? "online" : "offline") + " --- Players online: " + data.players);
}

// Catch server data errors
function serverStatusError(err) {
	$('#server-status').text("Error loading server status");
}

// Fire XHR for verifying a token
function fetchCharInfo() {
	var fetch = new XMLHttpRequest();
	fetch.onload = charLoad;
	fetch.onerror = charError;
	fetch.open('get', "https://esi.tech.ccp.is/verify/", true);
	fetch.setRequestHeader("Authorization", "Bearer " + loginData.token);
	fetch.send();
}

// Catch verify response
function charLoad() {
	var data = JSON.parse(this.responseText);
	loginData.name = data.CharacterName;
	loginData.id = data.CharacterID;
	// DEBUG
	loginData.tokenExpires = data.ExpiresOn;
	/*
	var ex = new Date(data.expiresOn);
	loginData.expires = Date.now() + ex;
	*/
	localStorage.loginData = JSON.stringify(loginData);
	
	var fetch = new XMLHttpRequest();
	fetch.onload = fetchPublicLoad;
	fetch.onerror = fetchPublicError;
	fetch.open('get', "https://esi.evetech.net/latest/characters/" + loginData.id + "/?datasource=tranquility", true);
	//fetch.setRequestHeader("Authorization", "Bearer " + token);
	fetch.send();
}

// Catch verify errors
function charError(err) {
	$('#as').find("a").text("Error loading character info");
}

function fetchPublicLoad() {
	var data = JSON.parse(this.responseText);
	loginData.corp_id = data.corporation_id;
	localStorage.loginData = JSON.stringify(loginData);
	console.log("Retrived all data, reloading page");
	location = location.href.split('?')[0];
}

function fetchPublicError(err) {
	alert("Error loading character public data in the background. Please log out and log in again");
}

function checkRoles() {
	var fetch = new XMLHttpRequest();
	fetch.onload = rolesLoad;
	fetch.onerror = rolesError;
	fetch.open('get', "https://esi.evetech.net/latest/characters/" + loginData.id + "/roles/?datasource=tranquility", true);
	fetch.setRequestHeader("Authorization", "Bearer " + loginData.token);
	fetch.send();
}

function rolesLoad() {
	var data = JSON.parse(this.responseText);
	
	if (data.error) {
		alert("Error loading character roles: " + data.error);
		console.error("Error loading character roles: " + data.error);
	}
	
	loginData.has_roles = data.roles.includes("Director");
	localStorage.loginData = JSON.stringify(loginData);
	
	// Track if character is a director to make life easier later on.
	if (!loginData.has_roles) {
		$('#limited-features').show();
	}
	loadThingsOntoPage();
}

function rolesError(err) {
	alert("Error loading character roles: " + err);
	console.error("Error loading character roles: " + err);
}

function loadThingsOntoPage() {
	/*
	I'd love to use flags, don't know how handy it would be though. Also not sure the best way to display all this info.
	
	Things we need to load:
		- Character inactivity:
			- Requires: Director
			- Endpoint: https://esi.evetech.net/latest/corporations/<corpID>/membertracking/?datasource=tranquility --Header Bearer <token>
			- Check for logout time greater then 30 days. Add to purge list.
		- Character participation:
			- Requires: Nothing except character ID
			- Endpoints:
				- IDs: https://esi.evetech.net/latest/corporations/<corpID>/members/?datasource=tranquility
				- zKill: 
			- Load last 100 entries for character on ZKill
				- This... might take a while
			- Check for most recent kill/lose, as well as "activity level" (How close together the dates of the kills are)
		- Character titles:
			- Requires: Director
			- Endpoint: https://esi.evetech.net/latest/corporations/<corpID>/members/titles/?datasource=tranquility
			- List character titles along with their names
	*/
	
	if (loginData.has_roles)
		fetchInactiveMembers();
	else
		fetchMemberIDs();
	
	$('#logged-in').show();
}

function fetchMemberIDs() {
	var fetch = new XMLHttpRequest();
	fetch.onload = loadMemberIDs;
	fetch.open('get', "https://esi.evetech.net/latest/corporations/" + loginData.corp_id + "/members/?datasource=tranquility", true);
	fetch.setRequestHeader("Authorization", "Bearer " + loginData.token);
	fetch.send();
}

function loadMemberIDs() {
	var data = JSON.parse(this.responseText);
	
	if (data.error) {
		console.log("Error loading member IDs: %1", json.error);
		return;
	}
	$('#nav-tabs').tabs("option", "active", 1);
	allIDs = data;
	lookupKillboards();
}

function fetchInactiveMembers() {
	var fetch = new XMLHttpRequest();
	fetch.onload = loadInactiveMembers;
	fetch.open('get', "https://esi.evetech.net/latest/corporations/" + loginData.corp_id + "/membertracking/?datasource=tranquility", true);
	fetch.setRequestHeader("Authorization", "Bearer " + loginData.token);
	fetch.send();
}

function loadInactiveMembers() {
	var json = JSON.parse(this.responseText);
	
	if (json.error) {
		console.log("Error loading member info: %1", json.error);
		return;
	}
	
	var cutoff = new Date();
	cutoff.setDate(cutoff.getDate() - 30);
	for (var key in json) {
		var breakDown = json[key].logon_date.split("T");
		var lastLogin = new Date(breakDown[0]);
		var joined = new Date(json[key].start_date.split("T")[0]);
		var toPurge = (lastLogin < cutoff);
		
		allIDs.push(json[key].character_id);
		if (toPurge)
			purgeIDs.push(json[key].character_id);
		
		var temp = {"id": json[key].character_id, "purge": toPurge, "last_on": lastLogin, "joined": joined};
		list.push(temp);
	}
	
	lookupKillboards();
	lookupCharIDs();
}

function lookupKillboards() {
	for (var i = 0; i < allIDs.length; i++) {
		var fetch = new XMLHttpRequest();
		fetch.onload = loadKillboards;
		fetch.open('get', "https://zkillboard.com/api/stats/characterID/" + allIDs[i] + "/", true);
		fetch.send();
	}
}

var statsLoaded = 0;
function loadKillboards() {
	var data = JSON.parse(this.responseText);
	
	var id = (data.info ? (data.info.id ? data.info.id : 0) : 0);
	if (id === 0) {
		statsLoaded++;
		console.log("Failed");
		return;
	}
	
	var member = list.filter(e => e.id == id);
	if (member)
		member = member[0];
	
	var date = new Date();
	var thisMonth = Number(date.getFullYear() + "" + (date.getMonth()+1 < 10 ? "0" : "")+(date.getMonth()+1));
	var lastMonth = Number((date.getFullYear()-(date.getMonth()===0 ? 1 : 0)) + "" + (date.getMonth() === 0 ? 12 : (date.getMonth() < 10 ? "0" : "")+date.getMonth()));
	var prevMonth = Number((date.getFullYear()-((date.getMonth()===0)||(date.getMonth()===1) ? 1 : 0)) + "" + ((date.getMonth() === 0) ? 11 : (date.getMonth() === 1 ? 12 : (date.getMonth()-1 < 10 ? "0" : ""))+(date.getMonth()-1)));
	
	var allTime;
	
	var corpKills = data.topAllTime;
	if (!corpKills) {
		corpKills = {};
		corpKills.data = [{kills: 0}];
	} else {
		corpKills = corpKills[1];
		
		allTime = corpKills.data.filter(e => e.corporationID == data.info.corporationID);
	}
	
	var temp = 	{
					id: id,
					name: (data.info ? data.info.name : "Unknown"),
					purge: (member ? (member.purge ? "Yes" : "") : ""),
					joined: (member ? member.joined : ""),
					last: (member ? member.last_on : ""),
					all_time: (allTime && allTime[0] && allTime[0].kills ? allTime[0].kills : 0),
					this_month_kills: (data.months ? (data.months[thisMonth] ? (data.months[thisMonth].shipsDestroyed ? data.months[thisMonth].shipsDestroyed : 0) : 0) : 0),
					this_month_losses: (data.months ? (data.months[thisMonth] ? (data.months[thisMonth].shipsLost ? data.months[thisMonth].shipsLost : 0) : 0) : 0),
					last_month_kills: (data.months ? (data.months[lastMonth] ? (data.months[lastMonth].shipsDestroyed ? data.months[lastMonth].shipsDestroyed : 0) : 0) : 0),
					last_month_losses: (data.months ? (data.months[lastMonth] ? (data.months[lastMonth].shipsLost ? data.months[lastMonth].shipsLost : 0) : 0) : 0),
					prev_month_kills: (data.months ? (data.months[prevMonth] ? (data.months[prevMonth].shipsDestroyed ? data.months[prevMonth].shipsDestroyed : 0) : 0) : 0),
					prev_month_losses: (data.months ? (data.months[prevMonth] ? (data.months[prevMonth].shipsLost ? data.months[prevMonth].shipsLost : 0) : 0) : 0),
				};
	
	kbdata.push(temp);
	
	statsLoaded++;
	if (statsLoaded === allIDs.length)
		showKillboard();
}

function showKillboard() {
	
	kbdata.sort(function (a, b) {
		if (a.this_month_kills > b.this_month_kills)
			return 1;
		else if (a.this_month_kills < b.this_month_kills)
			return -1;
		else {
			if (a.all_time > b.all_time)
				return 1;
			else if (a.all_time < b.all_time)
				return-1;
			else {
				if (a.name.toLowerCase() > b.name.toLowerCase())
					return 1;
				else if (a.name.toLowerCase() < b.name.toLowerCase())
					return -1;
			}
			
			return 0;
		}
	});
	var killTable = "";
	
	if (!loginData.has_roles) {
		$('#kbh-purge').hide();
		$('#kbh-last').hide();
		$('#kbh-join').hide();
	}
	
	for (var i = 0; i < kbdata.length; i++) {
		killTable += 	"<tr id='kb-"+kbdata[i].name.replace(/ /gi, "-")+"'>" +
							"<td><a class='tool-tip'><img src='./imgs/note.png' style='width:20px;height:20px;' class='dynamic-content has-note' /><span class='tool-tip-text'></span></a><a target=\"_blank\" href=\"https://zkillboard.com/character/"+kbdata[i].id+"/\">" + kbdata[i].name + "</a></td>" +
							(loginData.has_roles ? ("<td>" + kbdata[i].purge + "</td>") : "") +
							(loginData.has_roles ? ("<td data-date='"+kbdata[i].joined+"'>" + kbdata[i].joined.toString().substring(3,15) + "</td>") : "") +
							(loginData.has_roles ? ("<td data-date='"+kbdata[i].last+"'>" + kbdata[i].last.toString().substring(3,15) + "</td>") : "") +
							"<td>" + kbdata[i].all_time + "</td>" +
							"<td>" + kbdata[i].this_month_kills + "/" + kbdata[i].this_month_losses + "</td>" +
							"<td>" + kbdata[i].last_month_kills + "/" + kbdata[i].last_month_losses + "</td>" +
							"<td>" + kbdata[i].prev_month_kills + "/" + kbdata[i].prev_month_losses + "</td>" +
						"</tr>"
	}
	
	$('#killboard-activity').find('tbody').append(killTable);
	$('#killboard-activity').trigger("update");
	assignBackgrounds(2);
}

function lookupCharIDs() {
	var fetch = new XMLHttpRequest();
	fetch.onload = loadCharIDs;
	fetch.open('post', "https://esi.evetech.net/latest/universe/names/?datasource=tranquility", true);
	fetch.send(JSON.stringify(purgeIDs));
}

function loadCharIDs() {
	var data = JSON.parse(this.responseText);
	var tableText = "";
	
	if (data.error) {
		console.log(data.error);
		return;
	}
	
	data.sort(function(a,b) {
		var aName = a.name.toLowerCase();
		var bName = b.name.toLowerCase();
		if (aName > bName)
    			return 1;
    		if (aName < bName)
    			return -1;
    		else
    			return 0;
	});
	
	for (var i = 0; i < data.length; i++) {
		//list[data[i].id].name = data[i].name;
		var m = list.filter(e => e.id == data[i].id)[0];
		tableText += 	"<tr id='in-"+data[i].name.replace(/ /gi, "-")+"'>" + 
							"<td>" + (i+1) + "</td>" +
							"<td><a class='tool-tip'><img src='./imgs/note.png' style='width:20px;height:20px;' class='dynamic-content has-note' /><span class='tool-tip-text'></span></a>" + data[i].name + "</td>" +
							"<td data-date='"+m.joined+"'>" + m.joined.toString().substring(3,15) + "</td>" +
							"<td data-date='"+m.last_on+"'>" + m.last_on.toString().substring(3,15) + "</td>" +
							"<td data-date='"+m.last_on+"'>" + parseTimer(Date.now() - new Date(m.last_on), true) + "</td>" +
						"</tr>";
	}
	
	$('#purge-tab').show();
	$('#inactive-table').find('tbody').append(tableText);
	$('#inactive-table').trigger("update");
	assignBackgrounds(1);
}

function assignBackgrounds(type) {
	
	var prefix = "#";
	if (type == 1)
		prefix += "in-";
	else if (type == 2)
		prefix += "kb-";
	
	// Loop through the lists and color the rows
	stasisList.forEach(function(e) {
		$(prefix + e).css('background-color', purgeState.Stasis);
	});
	purgedList.forEach(function(e) {
		$(prefix + e).css('background-color', purgeState.Purged);
	});
	dnpList.forEach(function(e) {
		$(prefix + e).css('background-color', purgeState.Dnp);
	});
	for (var e in notesList) {
		$(prefix + e).find('.has-note').show();
		$(prefix + e).find('.tool-tip-text').text(notesList[e]);
	};
	
}

function parseSearch(variable) {
    var query = window.location.search.substring(1);
    var vars = query.split('&');
    for (var i = 0; i < vars.length; i++) {
        var pair = vars[i].split('=');
        if (decodeURIComponent(pair[0]) == variable) {
            return decodeURIComponent(pair[1]);
        }
    }
    console.log('Search variable %s not found', variable);
}

function parseHash(variable) {
    var query = window.location.hash.substring(1);
    var vars = query.split('&');
    for (var i = 0; i < vars.length; i++) {
        var pair = vars[i].split('=');
        if (decodeURIComponent(pair[0]) == variable) {
            return decodeURIComponent(pair[1]);
        }
    }
    console.log('Hash variable %s not found', variable);
}

function parseTimer(duration, largeOnly) {
	var seconds = parseInt((duration/1000)%60);
	var minutes = parseInt((duration/(1000*60))%60);
	var hours = parseInt((duration/(1000*60*60))%24);
	var days = parseInt((duration/(1000*60*60*24))%30);
	var months = parseInt((duration/(1000*60*60*24*30)%12));
	var years = parseInt((duration/(1000*60*60*24*30*12)));
	years = (years > 0) ? years + "y" : "";
	months = (months > 0) ? months + "mo" : "";
	days = (days > 0) ? days + "D" : "";
	hours = (hours > 0) ? ((hours < 10) ? "0" + hours : hours) + "H" : "";
	minutes = (minutes > 0) ? minutes + "M" : "";
	seconds = ((seconds < 10) ? "0" + seconds : seconds);
	
	if (largeOnly)
		return ((years != "") ? years + ":" : "") + ((months != "") ? months : "0mo") + ((days != "") ? ":"+days : "");
	else
		return ((years != "") ? years + ":" : "") + ((months != "") ? months + ":" : "") + ((days != "") ? days + ":" : "") + ((hours != "") ? hours + ":" : "") + ((minutes != "") ? minutes + ":" : "" ) + seconds + "S";
}

function tickTimer() {
	var remain = loginData.expires - Date.now();
	
	if (remain <= 0) {
		$("#timer").text(parseTimer(remain));
		$('#as').hide();
		$('#login').show();
		alert("Your session has expired.\nYou'll need to log in again if you reload this site.");
	}
	else {
		$("#timer").text(parseTimer(remain));
		setTimeout(tickTimer, 1000);
	}
}

function getCharName(id) {
	return id;
}

$(function() {
	$.tablesorter.addParser(
	{
		id: 'names',
		is: function(s) {
			return false;
		},
		format: function(s, table, cell) {
			var child = $(cell).contents()[1];
			return child.textContent.toLowerCase();
		},
		type: 'text'
	});

	$.tablesorter.addParser(
	{
		id: 'dates',
		is: function(s) {
			return false;
		},
		format: function(s, table, cell) {
			return new Date($(cell).attr('data-date'));
		},
		type: 'numeric'
	});

	$.tablesorter.addParser(
	{
		id: 'months',
		is: function(s) {
			return false;
		},
		format: function(s, table, cell) {
			var str = s.split("/");
			var n = Number.parseFloat(str[0]+"."+str[1]);
			return n;
		},
		type: 'numeric'
	});
	
	$('#killboard-activity').tablesorter({
		headers: {
			0: {
				sorter: 'names'
			},
			2: {
				sorter: 'dates'
			},
			3: {
				sorter: 'dates'
			},
			5: {
				sorter: 'months'
			},
			6: {
				sorter: 'months'
			},
			7: {
				sorter: 'months'
			}
		}
	});
	
	$('#inactive-table').tablesorter({
		headers: {
			1: {
				sorter: 'names'
			},
			2: {
				sorter: 'dates'
			},
			3: {
				sorter: 'dates'
			},
			4: {
				sorter: 'dates'
			}
		}
	});
});


