function abrirModalManual(options) {
    var abrirFuncao = options.abrirFuncao;
    var dialogSelector = options.dialogSelector;
    var overlay = $(".ui-widget-overlay"); 
    var estadoModal = ''; 

    abrirFuncao();
    jQuery(function($) {
        var dialogContent = $(dialogSelector);
        dialogContent.dialog({
            height: options.height || 700,
            width: options.width || "80%",
            resizable: options.resizable || false,
            modal: options.modal || false,
            draggable: options.draggable || false,
            close: function() {
                estadoModal = dialogContent.dialog("option", "maximized") ? 'maximizado' : 'minimizado';
                dialogContent.dialog("destroy");
                dialogContent.hide();
            },
            create: function() {
                $(this).dialogExtend({
                    "maximize": options.maximize || true,
                    "dblclick": options.dblclick || "maximize",
                    "icons": options.icons || { "maximize": "ui-icon-arrow-4-diag", "minimize": "ui-icon-circle-minus" },
                });
            }
        });

        if (estadoModal === 'maximizado') {
            dialogContent.dialog("option", "maximized", true);
        } else {
            dialogContent.dialog("option", "maximized", false);
        }
    });
}
