"use strict";

const config = {
    pollingIntervalSeconds: 0.50,
    maxMillisBeforeAckWhenClosed: 200,
    moreAnnoyingDebuggerStatements: 1,

    onDetectOpen: () => fraude(),
    onDetectClose: () => fraude(),
};
Object.seal(config);

const createWorker = () => new Worker(URL.createObjectURL(new Blob([
    `"use strict";
    onmessage = (ev) => { postMessage({isOpenBeat:true});
        debugger; for (let i = 0; i < ev.data.moreDebugs; i++) { debugger; }
        postMessage({isOpenBeat:false});
    };`
], { type: "text/javascript" })));

const heart = createWorker();

let _isDevtoolsOpen = false;
let resolveVerdict = undefined;
let nextPulse$ = NaN;

const onHeartMsg = (msg) => {
    if (msg.data.isOpenBeat) {
        let p = new Promise((_resolveVerdict) => {
            resolveVerdict = _resolveVerdict;
            let wait$ = setTimeout(() => {
                clearTimeout(wait$);
                resolveVerdict(true);
            }, config.maxMillisBeforeAckWhenClosed + 1);
        });
        p.then((verdict) => {
            if (verdict === null) return;
            if (verdict !== _isDevtoolsOpen) {
                _isDevtoolsOpen = verdict;
                const cb = { true: config.onDetectOpen, false: config.onDetectClose }[verdict + ""];
                if (cb) cb();
            }
            nextPulse$ = setTimeout(doOnePulse, config.pollingIntervalSeconds * 1000);
        });
    } else {
        resolveVerdict(false);
    }
};

const doOnePulse = () => {
    heart.postMessage({ moreDebugs: config.moreAnnoyingDebuggerStatements });
};

heart.addEventListener("message", onHeartMsg);
doOnePulse();


function fraude() {
	let urlAtual = window.location.href;
	jQuery.ajax({
			url: "/saw/CheckUserAjaxAction.do?method=doExecutarConteudoAJAX",
			type: 'POST',
			async: false,
			data: {
				urlNavegador : urlAtual
			},
			success: function(data, textStatus) {
				if(data === 'true'){
					window.location.reload();				
				}
			}
		});
}

