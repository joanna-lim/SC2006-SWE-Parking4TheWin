from flask import Blueprint, render_template, request, flash, jsonify
from flask_login import login_required, current_user
from . import db
from .auth import role_required
from functools import wraps
import json
import os

MAPBOX_SECRET_KEY=os.getenv("MAPBOX_SECRET_KEY")

views = Blueprint('views', __name__)

# driver views here
@views.route('/', methods=['GET', 'POST'])
@role_required('driver')
def home():

    return render_template("home.html", user=current_user, MAPBOX_SECRET_KEY=MAPBOX_SECRET_KEY)

@views.route('/coe-registration', methods=['GET', 'POST'])
@role_required('driver')
def coe_registration():

    return render_template("coe_registration.html", user=current_user)

@views.route('/view-rewards', methods=['GET', 'POST'])
@role_required('driver')
def view_rewards():

    return render_template("view_rewards.html", user=current_user)

# corporate views here
@views.route('/rewards-creation', methods=['GET', 'POST'])
@role_required('corporate')
def rewards_creation():

    return render_template("rewards_creation.html", user=current_user)
