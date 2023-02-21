from flask import Blueprint, render_template, request, flash, jsonify
from flask_login import login_required, current_user
from . import db
from .auth import role_required
from functools import wraps
import json

views = Blueprint('views', __name__)

@views.route('/', methods=['GET', 'POST'])
@role_required('driver')
def home():

    return render_template("home.html", user=current_user)
