"use strict";
$(function() {
    const S3_CLOUDFRONT_HOST = $('body').attr('data-icon-cdn');
    const csrfToken = $('#commandpedia').attr('csrf');

    let page = 0;
    let insearch = false;

    function renderCommands(result) {
        let commands = result.data;
        let container = $('#command-container');
        container.empty();
        for (let i = 0; i < Math.min(commands.length, 9); i++) {
            let command = commands[i];
            if (i % 6 === 0)
                container.append($('<div>').addClass('clearfix visible-lg visible-md'));
            else if (i % 3 === 0)
                container.append($('<div>').addClass('clearfix visible-lg'));
            else if (i % 2 === 0)
                container.append($('<div>').addClass('clearfix visible-md'));

            let commandContainer = $('<div>').addClass('col-lg-4 col-md-6 dev-template');
            let panel = $('<div>').addClass('panel panel-default');
            commandContainer.append(panel);

            //let heading = $('<p>').addClass('panel-heading').text(command.deviceNames.join(' + '));
            //panel.append(heading);

            let body = $('<div>').addClass('panel-body');
            let main = $('<div>').addClass('row').addClass('panel-body-main');
            let icons = $('<div>').addClass('device-icon-list-small');
            command.devices.forEach((device) => {
                let link = $('<a>').attr('href', '/thingpedia/devices/by-id/' + device);
                let icon = $('<img>').attr('src', S3_CLOUDFRONT_HOST + '/icons/' + device + '.png');
                link.append(icon);
                icons.append(link);
            });
            main.append(icons);
            let info = $('<div>');
            main.append(info);
            let utterance = $('<p>').addClass('command-utterance').attr('title', command.target_code).text(command.utterance);
            info.append(utterance);

            let user = $('<div>').addClass('device-owner');
            user.append($('<span>').text(`By ${command.owner_name || 'anonymous user'}`));
            let like = $('<a>');
            let heart = $('<i>').addClass('far').addClass('fa-heart').attr('id', command.id).attr('_csrf', csrfToken);
            like.append(heart);
            user.append(like);
            let count = $('<span>').attr('id', 'count' + command.id).text(command.click_count);
            user.append(count);
            info.append(user);
            body.append(main);
            panel.append(body);

            let footer = $('<div>').addClass('panel-footer');
            let footer_row = $('<div>').addClass('row');
            let footer_container = $('<div>').addClass('col-md-6').addClass('col-md-offset-3');
            let form = $('<form>').addClass('form-inline').attr('action', '/me').attr('method', 'post');
            footer_container.append(form);
            form.append($('<input>').attr('type', 'hidden').attr('name', '_csrf').attr('value', csrfToken));
            form.append($('<input>').attr('type', 'hidden').attr('name', 'command').attr('value', command.utterance));
            form.append($('<button>').addClass('btn').addClass('btn-sm').addClass('btn-success').addClass('btn-block').attr('type', 'submit').text('Adopt'));
            footer_row.append(footer_container);
            footer.append(footer_row);
            panel.append(footer);

            container.append(commandContainer);
        }

        if (insearch) {
            $('#command-reset-button').show();
            $('#commands-page-prev').hide();
            $('#commands-page-next').hide();
        } else {
            $('#command-reset-button').hide();

            if (page > 0)
                $('#commands-page-prev').show();
            else
                $('#commands-page-prev').hide();

            if (commands.length > 9)
                $('#commands-page-next').show();
            else
                $('#commands-page-next').hide();
        }

        $('.fa-heart').click(function(event) {
            let icon = $('#' + this.id);

            let count = $('#count' + this.id);
            let current = Number(count.text());

            if (icon.hasClass('far')) {
                icon.removeClass('far').addClass('fas');
                $.post('/thingpedia/examples/upvote/' + this.id, '_csrf=' + $(this).attr('_csrf'));
                count.text(current + 1);
            } else {
                icon.removeClass('fas').addClass('far');
                $.post('/thingpedia/examples/downvote/' + this.id, '_csrf=' + $(this).attr('_csrf'));
                count.text(current - 1);
            }
            event.preventDefault();
        });
    }

    function loadAll() {
        $.get('/thingpedia/api/commands/all?page=' + page, renderCommands);
    }

    loadAll();

    $('#commands-page-prev').click(function(event) {
        page = page - 1;
        if (!(page >= 0))
            page = 0;
        loadAll();
        event.preventDefault();
    });
    $('#commands-page-next').click(function(event) {
        page = page + 1;
        loadAll();
        event.preventDefault();
    });
    $('#command-search-button').click(function(event) {
        page = 0;
        insearch = true;
        $.get('/thingpedia/api/commands/search?q=' + encodeURIComponent($('#command-search-box').val()), renderCommands);
        event.preventDefault();
    });
    $('#command-reset-button').click(function(event) {
        page = 0;
        insearch = false;
        loadAll();
        event.preventDefault();
    });

});
