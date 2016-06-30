// register.js ~ Copyright 2016 Manchester Makerspace ~ License MIT

var display = {
    removeValues: function(){              // set all input values to blank
        $(':text').val('');
        $(':password').val('');
        $('#groupSize').val('');
        $('#months').val('');
    },
    entryType: function(){
        var type = $('#accountType').val();
        $('.regEntries').hide();
        display.removeValues();
        $('#regBtn').show();               // make sure user has to refresh in case of mistake
        $('#nameEntry').show();
        $('#startEntry').show();
        if(type === "Individual"){         // this one is super simple, just enter info to get expiry time
            $('#monthsEntry').show();
        } else if(type === 'Landlord'){    // Landlord gets a non-expiring key, requested use over physical key for security purposes
            $('#startEntry').hide();
        } else if(type === 'Group'){       // make a token that uses the group admins expiry time
            $('#nameEntry').show();
            $('#enterGroup').show();
            $('#regBtn').hide();
            $('#startEntry').hide();
        } else if (type === 'Admin'){      // non-expiring key, board/employees pay dues given project use of space
            $('#monthsEntry').show();      // however if they are paying members we will happily remind them when their dues are up
            $('#passwordEntry').show();    // this allows board members to have indivdual admin rights as oppossed to using a master key
        } else if (type === 'Contractor'){ // makes a temp pass, TODO: add end date
        } else if (type === 'Partner'){
            $('#monthsEntry').show();
        }
    },
    findGroup: function(){                 // is called when pressing the found button (on click)
        var whichGroup = $('#groupEntry').val();
        if (whichGroup){
            sock.et.emit("findGroup", whichGroup);
        } else {$('#msg').text('please enter a group');}
    },
    foundGroup: function(group){           // is called when a group is found (on socket)
        if(group.exist){
            $('#groupFindMsg').text('add member to: ' + $('#groupEntry').val());
            $('#enterGroupSize').hide();
            $('#monthsEntry').hide();
            $('#startEntry').hide();
        } else {
            $('#groupFindMsg').text('Group not found: will create new group');
            $('#enterGroupSize').show();
            $('#monthsEntry').show();
            $('#startEntry').show();
        }
        $('#regBtn').show();
    }
}

var register = {
    botID: null,
    cardID: null,
    type: null,
    submit: function(){
        if (register.type === 'member'){register.member();}
        else if (register.type === 'bot'){register.bot();}
        else if (register.type === 'find'){search.find();}
    },
    withConditions: function(member, startDate, months ){ // returns validation requirements per type of member
        if      (member.status === 'Individual') { return (startDate || (months > 0 && months < 14)) && member.fullname; }
        else if (member.status === 'Group') {
            if (member.groupKeystone) {
                return (startDate || (months > 0 && months < 14)) && member.fullname && member.groupName && member.groupSize;
            } else { return startDate && member.fullname && member.groupName;}
        }
        else if (member.status === 'Partner') {
            return (startDate || (months > 0 && months < 14)) && member.fullname;
            // TODO make sure partners have keystones just like groups
        }
        else if (member.status === 'Admin')      { return member.fullname && member.password; }
        else if (member.status === 'Landlord')   { return member.fullname; }
        else if (member.status === 'Contractor') { return startDate && member.fullname }
    },
    member: function(){
        var months = $('#months').val();                   // get months and or start date to determine expire time
        var startDate = $('#startDate').val();
        var member = {
            fullname: $('#name').val(),                    // full name of member, must be unique
            cardID: register.cardID,                       // unique card id of this member
            expirationTime: expire.sAt(months, startDate), // determine expire time
            status: $('#accountType').val(),               // type of member, if revoked this with change to "Revoked"
            accesspoints: [register.botID],                // intial point of access, TODO facility to add points of access
            groupName: $('#groupEntry').val(),             // name of group if applicable
            groupKeystone: false,                          // whether group keystone or not, if applicable
            groupSize: $('#groupSize').val(),              // group size note for potential limits
            password: $('#password').val(),                // passwords for admin access of employees or board members
        }
        if(member.groupSize){ member.groupKeystone = true;}            // group size is only shown to keystone members of groups
        if(register.withConditions(member, startDate, months)){        // get proper validation for this user type
            sock.et.emit('newMember', member);                         // emit new member to sever
            app.display('search');                                     // display search screen on when done
            display.removeValues();                                    // don't let potential sensitive info linger
        } else { $('#msg').text('Please enter correct information'); } // given not valid registration information
    },
    bot: function(){
        var botName = $('#botName').val();
        var type = $('#botType').val();
        if(botName && type){              // make sure we have proper information to proceed
            sock.et.emit('newBot', {      // emit information to server
                fullname: botName,
                type: type,
                machine: register.botID
            });
            app.display('search');
        } else { $('#msg').text('Please enter correct information'); }
    }
}

var expire = {                                      // determine member expirations
    dByExactTime: function(endTime){                // determine if a member has expired
        var currentDate = new Date().getTime();
        var endDate = new Date(endTime).getTime();
        if(currentDate > endDate){
            return true;
        } else { return false; }
    },
    sAt: function(months, startDate){                               // determine when a member will expire
        if(startDate){ startDate = new Date(startDate).getTime(); } // convert start date to milliseconds from unix epoch
        else { startDate = new Date().getTime(); }                  // otherwise take current time in milliseconds from unix epoch
        if (months){                                                // given we need to calculate expire date
            return startDate + months * 1000 * 60 * 60 * 24 * 30;   // second*minute*hour*day*month = millis per x months + start millis
        } else { return startDate; }                                // given no months are provide start date becomes end date
    }
}

var search = {
    member: null,
    find: function(){
        var query = $('#findName').val();
        if(query){ sock.et.emit('find', query); }                   // pass a name for sever to look up given a query
        else { $('#msg').text('enter a member to search'); }        // otherwise ask for a query
    },
    memberScan: function(scan){
        $('#cardScan').show().on('click', function(){
            search.found(scan);
            $('#cardScan').hide().off();
        });
    },
    found: function(info){
        $('#foundMember').show()
        $('#msg').text('Found member');
        search.member = info;
        $('#findResult').show();
        $('#nameResult').text(info.fullname);
        $('#memberStatus').text(info.status);
        $('#expiration').text(new Date(info.expirationTime).toDateString());
        $('#expired').text(expire.dByExactTime(info.expirationTime));
        var access = '';
        for(var i = 0; i < info.accesspoints.length; i++){
            if(i){access += ', ';}
            access += info.accesspoints[i];
        }
        $('#accesspoints').text(access);
    },
    revokeAll: function(){sock.et.emit('revokeAll', $('#nameResult').text() );},
    renew: function(){
        var months = $('#renewMonths').val();
        if(months && months < 14){                                                        // more than zero, less than 14
            var member = { fullname: $('#nameResult').text() };
            if(expire.dByExactTime(search.member.expirationTime)){                        // given membership has expired
                member.expirationTime = expire.sAt(months);                               // renew x months from current date
            } else {                                                                      // given membership has yet to expire
                member.expirationTime = expire.sAt(months, search.member.expirationTime); // renew x month from expiration
            }
            sock.et.emit('renew', member);                                                // emit renewal to server to update db
        } else {$('#msg').text("enter a valid amount of months");}                        // test admin to do it right
    }
}

var sock = {                                                   // Handle socket.io connection events
    et: io(),                                                  // start socket.io listener
    init: function(){                                          // allow chat and go when we have a name
        sock.et.on('regMember', sock.regMem);                  // recieves real time chat information
        sock.et.on('regBot', sock.newbot);                     // handles registering new accesspoints
        sock.et.on('message', sock.msg);
        sock.et.on('found', search.found);
        sock.et.on('memberScan', search.memberScan);           // make the TSA proud
        sock.et.on('foundGroup', display.foundGroup);          // show "found existing group" or "new group"
    },
    regMem: function(data){
        $('#msg').text('Unknown card scanned');
        app.display('regMember')                               // show new member form
        register.cardID = data.cardID;                         // fill cardID to submit
        register.botID = data.machine;                         // fill machine value to submit TODO show which machine
        $('#memMsg').text("Register Member:" + data.cardID);   // indicated ready for submission
    },
    newbot: function(machineID){
        $('#msg').text('New bot found');
        app.display('regBot');                                 // show new bot form
        register.botID = machineID;                            // fill machine value to submit TODO name machine
        $('#botMsg').text("Register bot:" + machineID);        // indicated ready for submission
    },
    msg: function(msg){$('#msg').text(msg);},
}

var app = {
    init: function(){
        sock.init();
        $('.reject').on('click', function(){app.display('search');});
        $('.submit').on('click', register.submit);
        $('#revokeAll').on('click', search.revokeAll);
        $('#renew').on('click', search.renew);
        $('#findGroup').on('click', display.findGroup);
        $('#accountType').on('change', display.entryType);     // ask for proper information depending on type of entry
        $(document).keydown(function(event){
            if(event.which === 13){register.submit();}         // given enter button is pressed do same thing as clicking register
        });
        app.display('search');
    },
    display: function(view){
        $('.view').hide();
        if(view === "regMember"){
            register.type = 'member';
            $("#registerMember").show();
        } else if (view === 'regBot') {
            register.type = 'bot';
            $("#registerBot").show();
        } else if (view === 'search'){
            register.type = 'find';
            $("#findMember").show();
        }
    }
}

$(document).ready(app.init);
